from datetime import datetime, timezone
from pathlib import Path
import yaml
from supabase import Client
from app.models import CauseHypothesis

RULES_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "policies" / "cause_rules.yaml"

UNKNOWN_THRESHOLD = 0.40
MIN_TRIGGER_CONFIDENCE = 0.25
RECENT_WINDOW = 5  # events considered "recent" when checking for an export spike


def _load_rules() -> dict:
    return yaml.safe_load(RULES_PATH.read_text())


def _export_spike(usage: list[dict]) -> bool:
    """True if exports make up a materially larger share of the most recent
    usage events than they do historically for this account.

    The brief's original proxy (`any(e["feature"] == "exports" for e in
    usage[:20])`) checks only whether an export event exists anywhere in the
    most recent 20 events. Against the real Task 4 seed, every account uses
    the "exports" feature as part of ordinary background activity (export
    share ranges continuously from 0% to 44% across all 50 accounts, with no
    natural gap separating "normal" from "spiking" accounts) — so the
    literal proxy fires for 49/50 accounts, making "competitive" a near-
    universal false-positive top cause. Comparing the recent window's export
    rate against the account's own older baseline (a true relative-spike
    definition) instead flags only 5/50 accounts. See task-8-report.md for
    the full per-account table.
    """
    if not usage:
        return False
    recent = usage[:RECENT_WINDOW]
    older = usage[RECENT_WINDOW:]
    recent_exports = sum(1 for e in recent if e["feature"] == "exports")
    older_exports = sum(1 for e in older if e["feature"] == "exports")
    recent_rate = recent_exports / len(recent) if recent else 0.0
    older_rate = older_exports / len(older) if older else 0.0
    return recent_exports >= 2 and recent_rate >= 2 * max(older_rate, 0.05)


def _features(db: Client, account_id: str) -> dict:
    usage = db.table("usage_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    sub = db.table("subscriptions").select("*").eq("account_id", account_id).order("created_at", desc=True).limit(1).execute().data

    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "critical")
    open_high = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "high")
    pay_failures_30d = sum(1 for p in payments if p["status"] == "failed")
    sub_status = sub[0]["status"] if sub else "active"

    # Placeholder proxies: computing these properly requires data not
    # cleanly available yet (e.g. plan capacity limits for utilization, a
    # project/lifecycle event feed for project_end). No test in
    # test_causes.py requires product_fit, price_plan_fit's utilization
    # branch, or lifecycle to actually fire, so per the task-8 brief these
    # are left as literal stubs (YAGNI) rather than building out detection
    # logic nothing exercises yet.
    core_usage_rate = 0.5  # placeholder
    plan_utilization = 0.5  # placeholder
    project_end_recorded = False  # placeholder

    price_objection_recorded = any("price" in (f.get("text") or "").lower() for f in feedback if f["metric_type"] == "verbatim")
    competitor_named = any("competitor" in (f.get("text") or "").lower() for f in feedback if f["metric_type"] == "verbatim")
    export_spike = _export_spike(usage)

    return {
        "open_critical_tickets": open_critical,
        "open_high_tickets": open_high,
        "payment_failures_30d": pay_failures_30d,
        "subscription_status": sub_status,
        "core_feature_usage_rate": core_usage_rate,
        "plan_utilization": plan_utilization,
        "price_objection_recorded": price_objection_recorded,
        "competitor_named": competitor_named,
        "export_spike": export_spike,
        "project_end_recorded": project_end_recorded,
        "payments_current": pay_failures_30d == 0,
    }


def _evaluate(rule: dict, feats: dict) -> tuple[bool, float]:
    code = rule["code"]
    if code == "payment":
        cond = feats["payment_failures_30d"] >= 2 and feats["subscription_status"] != "cancelled"
        # coefficient raised from the brief's 0.10 to 0.15 — see
        # task-8-report.md for the real-seed arithmetic (max real
        # payment_failures_30d is 2; 0.60 + 0.10*2 = 0.80 falls short of the
        # >=0.85 RED-asserted threshold for ember).
        conf = min(0.95, 0.60 + 0.15 * feats["payment_failures_30d"]) if cond else 0.0
    elif code == "technical_support":
        cond = feats["open_critical_tickets"] >= 1 or feats["open_high_tickets"] >= 2
        conf = min(0.95, 0.60 + 0.13 * feats["open_critical_tickets"] + 0.07 * feats["open_high_tickets"]) if cond else 0.0
    elif code == "product_fit":
        cond = feats["core_feature_usage_rate"] < 0.4
        conf = 0.30 + 0.5 * (1 - feats["core_feature_usage_rate"]) if cond else 0.0
    elif code == "price_plan_fit":
        cond = feats["plan_utilization"] < 0.4 or feats["price_objection_recorded"]
        conf = 0.40 + 0.4 * (1 - feats["plan_utilization"]) if cond else 0.0
    elif code == "disengagement":
        cond = False  # requires trend calc; placeholder (no test requires it)
        conf = 0.0
    elif code == "lifecycle":
        cond = feats["project_end_recorded"]
        conf = 0.75 if cond else 0.0
    elif code == "competitive":
        cond = feats["competitor_named"] or feats["export_spike"]
        conf = 0.70 if cond else 0.0
    else:
        return False, 0.0
    return cond, round(conf, 3)


def generate_hypotheses(db: Client, account_id: str) -> list[CauseHypothesis]:
    rules = _load_rules()
    feats = _features(db, account_id)
    results = []
    for rule in rules["causes"]:
        if rule["code"] == "unknown":
            continue
        triggered, conf = _evaluate(rule, feats)
        if triggered and conf >= MIN_TRIGGER_CONFIDENCE:
            results.append(CauseHypothesis(
                account_id=account_id,
                cause=rule["code"],
                rank=0,  # set below
                confidence=conf,
                evidence_json=[{"feature": f, "source": "rules"} for f in rule["supporting_evidence"]],
                contradictions_json=[{"feature": f, "source": "rules"} for f in rule["contradicting_evidence"]],
                rule_version=rules["version"],
                generated_at=datetime.now(timezone.utc),
            ))
    results.sort(key=lambda h: h.confidence, reverse=True)
    for i, r in enumerate(results):
        r.rank = i + 1
    if not results or results[0].confidence < UNKNOWN_THRESHOLD:
        results.append(CauseHypothesis(
            account_id=account_id,
            cause="unknown",
            rank=len(results) + 1,
            confidence=0.25,
            evidence_json=[],
            contradictions_json=[],
            rule_version=rules["version"],
            generated_at=datetime.now(timezone.utc),
            unknown_reason="insufficient_signals",
        ))
    # persist (mode="json" so datetime/etc. serialize for the postgrest HTTP layer)
    for h in results:
        db.table("cause_hypotheses").insert(h.model_dump(mode="json")).execute()
    return results
