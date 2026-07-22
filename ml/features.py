"""Point-in-time feature extraction shared by training (synthetic events) and
inference (Supabase rows). Pure function over raw event dicts — no db handle —
so the exact same code path produces the feature vector in both places.

FEATURE_ORDER is frozen: models are trained against this order and artifacts
store it. Changing the order/length silently invalidates saved models, so
registry.load_model asserts the artifact's stored order matches this one.
"""
from datetime import datetime, timezone

# Frozen feature order. Append-only; never reorder or remove without retraining.
FEATURE_ORDER = [
    "recent_usage",          # usage events in the last 30d
    "usage_trend_30d",       # recent-30d count minus prior-30d count (negative = declining)
    "open_critical_tickets",
    "open_high_tickets",
    "pay_failures_30d",
    "avg_feedback",          # mean feedback score, default 5.0 when none
    "days_to_renewal",
    "adoption_ratio",        # share of usage on the core_workflow feature
    "export_share",          # share of usage on the exports feature
]


def _parse(ts) -> datetime | None:
    if not ts:
        return None
    dt = ts if isinstance(ts, datetime) else None
    if dt is None:
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except ValueError:
            return None
    # Normalize to tz-aware UTC so date-only values (e.g. "2026-08-12", which
    # parses naive) can be compared against a tz-aware `now`.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def extract_features(usage, payments, tickets, feedback, subscription, *, now: datetime) -> dict:
    """Build the ordered feature dict from raw event lists.

    Mirrors the counting logic in app.modules.causes._features and
    app.modules.risk.predict_risks, but reads passed-in lists of dicts rather
    than querying a db, so it is reusable for in-memory synthetic training data.
    `now` is a required parameter (never datetime.now() internally) to keep
    training deterministic and inference testable.
    """
    usage = usage or []
    payments = payments or []
    tickets = tickets or []
    feedback = feedback or []

    def within(ts, lo_days, hi_days):
        dt = _parse(ts)
        if dt is None:
            return False
        age = (now - dt).total_seconds() / 86400.0
        return lo_days <= age < hi_days

    recent_usage = sum(1 for e in usage if within(e.get("timestamp"), 0, 30))
    prior_usage = sum(1 for e in usage if within(e.get("timestamp"), 30, 60))
    usage_trend_30d = recent_usage - prior_usage

    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t.get("severity") == "critical")
    open_high = sum(1 for t in tickets if not t.get("closed_at") and t.get("severity") == "high")

    pay_failures_30d = sum(
        1 for p in payments if p.get("status") == "failed" and within(p.get("timestamp"), 0, 30)
    )

    scores = [f["score"] for f in feedback if f.get("score") is not None]
    avg_feedback = sum(scores) / len(scores) if scores else 5.0

    days_to_renewal = 365.0
    if subscription and subscription.get("renewal_date"):
        rd = _parse(subscription["renewal_date"])
        if rd is not None:
            days_to_renewal = (rd - now).total_seconds() / 86400.0

    total_usage = len(usage)
    adoption_ratio = (sum(1 for e in usage if e.get("feature") == "core_workflow") / total_usage) if total_usage else 0.0
    export_share = (sum(1 for e in usage if e.get("feature") == "exports") / total_usage) if total_usage else 0.0

    feats = {
        "recent_usage": recent_usage,
        "usage_trend_30d": usage_trend_30d,
        "open_critical_tickets": open_critical,
        "open_high_tickets": open_high,
        "pay_failures_30d": pay_failures_30d,
        "avg_feedback": avg_feedback,
        "days_to_renewal": days_to_renewal,
        "adoption_ratio": adoption_ratio,
        "export_share": export_share,
    }
    return {k: float(feats[k]) for k in FEATURE_ORDER}


def to_vector(feats: dict) -> list[float]:
    """Ordered feature vector for model input."""
    return [feats[k] for k in FEATURE_ORDER]
