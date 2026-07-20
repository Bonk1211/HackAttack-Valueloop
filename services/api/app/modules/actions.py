from datetime import datetime, timezone
from supabase import Client
from app.models import ActionRecommendation
from app.modules.policy import load_actions, check_eligibility
from app.modules.health import score_health
from app.modules.risk import predict_risks


def _context(db: Client, account_id: str, *, health=None, risks=None) -> dict:
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    sub = (
        db.table("subscriptions")
        .select("*")
        .eq("account_id", account_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if health is None:
        health = score_health(db, account_id)
    if risks is None:
        risks = predict_risks(db, account_id)
    exp_risk = next((r for r in risks if r.risk_type == "expansion_readiness"), None)

    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "critical")
    open_high = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "high")
    payment_failure_evidence = any(p["status"] == "failed" for p in payments)
    price_objection = any(
        "price" in (f.get("text") or "").lower() for f in feedback if f["metric_type"] == "verbatim"
    )
    sub_row = sub[0] if sub else None
    sub_status = sub_row["status"] if sub_row else "active"
    cancel_at = sub_row.get("cancel_at") if sub_row else None

    return {
        "open_critical_tickets": open_critical,
        "open_high_tickets": open_high,
        "payment_failure_evidence": payment_failure_evidence,
        # Real signal, not a hardcoded placeholder: low engagement (few
        # active days in the last 30) stands in for low plan utilization
        # since there's no numeric plan-capacity field in the schema.
        "plan_utilization_low": health.engagement < 30,
        "price_objection": price_objection,
        # Real signal: an active-but-past_due/cancelling subscription is
        # lifecycle evidence for pausing, sourced from subscriptions.status
        # / cancel_at rather than a hardcoded False.
        "lifecycle_evidence": sub_status in ("past_due", "cancelled") or bool(cancel_at),
        "expansion_readiness_high": (exp_risk.probability >= 0.70) if exp_risk else False,
        "experience_score": health.experience,
    }


def _utility(benefit: str, friction: str, risk: str) -> float:
    benefit_v = {"high": 0.9, "medium": 0.6, "low": 0.3}.get(benefit, 0.3)
    friction_v = {"high": 0.8, "medium": 0.5, "low": 0.2}.get(friction, 0.3)
    risk_v = {"high": 0.7, "medium": 0.4, "low": 0.1}.get(risk, 0.3)
    return round(benefit_v - friction_v * 0.3 - risk_v * 0.3, 3)


def recommend_actions(
    db: Client,
    account_id: str,
    *,
    health=None,
    risks=None,
) -> list[ActionRecommendation]:
    actions = load_actions()
    ctx = _context(db, account_id, health=health, risks=risks)
    recs = []
    for action in actions:
        eligible, rejection = check_eligibility(db, account_id, action, ctx)
        approval_required = action["approval"] not in (False, "false", None)
        rec = ActionRecommendation(
            account_id=account_id,
            action_code=action["code"],
            eligibility=eligible,
            rejection_reason=rejection,
            utility_score=_utility(action["benefit"], action["friction"], action["risk"]) if eligible else None,
            approval_required=approval_required,
            approval_reason=f"{action['approval']} approval required" if approval_required else None,
            benefit=action["benefit"],
            friction=action["friction"],
            risk=action["risk"],
            generated_at=datetime.now(timezone.utc),
        )
        recs.append(rec)
        # persist (mode="json" so datetime/etc. serialize for the postgrest HTTP layer)
        db.table("action_recommendations").insert(rec.model_dump(mode="json")).execute()
    return recs
