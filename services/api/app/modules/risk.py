import sys
from datetime import datetime, timezone
from pathlib import Path

import structlog
from supabase import Client

from app.models import RiskPrediction

# ponytail: the backend runs with CWD=services/api, but the `ml` package lives
# at the repo root (blueprint §16.2). Put the repo root on sys.path so `import
# ml` resolves regardless of CWD. Upgrade path: package `ml` and add it as a
# real dependency if it ever ships separately.
_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from ml.explain import explain  # noqa: E402
from ml.features import extract_features, to_vector  # noqa: E402
from ml.registry import ModelUnavailable, load_model  # noqa: E402

log = structlog.get_logger()

RISK_TYPES = ["cancellation", "downgrade", "inactivity", "payment_failure", "expansion_readiness"]


def _risk(risk_type, prob, conf, features=None, version="1.0") -> RiskPrediction:
    return RiskPrediction(
        account_id="",  # set by caller
        risk_type=risk_type,
        probability=round(max(0.0, min(1.0, prob)), 3),
        confidence=round(max(0.0, min(1.0, conf)), 3),
        top_features_json=features or [],
        model_version=version,
        generated_at=datetime.now(timezone.utc),
    )


def _model_confidence(prob: float) -> float:
    """Confidence from a calibrated probability: farther from the 0.5 decision
    boundary = more confident. Maps [0,1] prob to [0.5,1.0] confidence."""
    return 0.5 + abs(prob - 0.5)


def _rules_fallback(risk_type: str, usage: list, payments: list, tickets: list, feedback: list) -> RiskPrediction:
    """Deterministic rules — the original hand-tuned formulas, kept verbatim as
    the model-unavailable path (blueprint §12.2). Reproduces the exact demo
    numbers test_risks.py asserts, so the demo survives with zero artifacts."""
    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] in ("critical", "high"))
    pay_failures_30d = sum(1 for p in payments if p["status"] == "failed")
    recent_usage = len(usage)
    feedback_scores = [f["score"] for f in feedback if f.get("score") is not None]
    avg_feedback = sum(feedback_scores) / len(feedback_scores) if feedback_scores else 5.0
    v = f"{risk_type}-rules-fallback"

    if risk_type == "cancellation":
        prob = 0.3 + 0.25 * open_critical + max(0, (30 - recent_usage) / 30) * 0.3
        conf = 0.7 + 0.05 * (open_critical + (1 if pay_failures_30d else 0))
        feat = [{"feature": "open_critical_tickets", "value": open_critical}]
    elif risk_type == "downgrade":
        prob = 0.2 + max(0, (30 - recent_usage) / 30) * 0.4 + max(0, (7 - avg_feedback) / 10) * 0.3
        conf = 0.65
        feat = [{"feature": "recent_usage", "value": recent_usage}]
    elif risk_type == "inactivity":
        prob = max(0, (20 - recent_usage) / 20) * 0.8
        conf = 0.6
        feat = [{"feature": "recent_usage", "value": recent_usage}]
    elif risk_type == "payment_failure":
        prob = min(0.95, 0.2 + 0.3 * pay_failures_30d)
        conf = 0.85 if pay_failures_30d else 0.5
        feat = [{"feature": "pay_failures_30d", "value": pay_failures_30d}]
    else:  # expansion_readiness
        prob = 0.1 + min(1, recent_usage / 40) * 0.4 + (avg_feedback / 10) * 0.4
        if open_critical:
            prob *= 0.3
        conf = 0.7
        feat = [{"feature": "avg_feedback", "value": round(avg_feedback, 2)}]
    return _risk(risk_type, prob, conf, feat, version=v)


def predict_risks(db: Client, account_id: str, *, persist: bool = True) -> list[RiskPrediction]:
    usage = db.table("usage_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    sub = db.table("subscriptions").select("*").eq("account_id", account_id).order("created_at", desc=True).limit(1).execute().data
    subscription = sub[0] if sub else None

    now = datetime.now(timezone.utc)
    feats = extract_features(usage, payments, tickets, feedback, subscription, now=now)
    vec = to_vector(feats)

    preds = []
    for t in RISK_TYPES:
        try:
            b = load_model(t)
            prob = float(b["model"].predict_proba([vec])[0, 1])
            preds.append(_risk(t, prob, _model_confidence(prob), explain(b, feats), version=b["version"]))
        except ModelUnavailable:
            log.info("risk.model_unavailable.fallback", risk_type=t, account_id=account_id)
            preds.append(_rules_fallback(t, usage, payments, tickets, feedback))

    for p in preds:
        p.account_id = account_id
    # persist (mode="json" so datetime/etc. serialize for the postgrest HTTP layer)
    if persist:
        for p in preds:
            db.table("risk_predictions").insert(p.model_dump(mode="json")).execute()
    return preds
