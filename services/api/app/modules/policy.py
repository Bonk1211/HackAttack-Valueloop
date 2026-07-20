from datetime import datetime, timedelta, timezone
from pathlib import Path
import yaml
from supabase import Client

POLICY_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "policies" / "actions.yaml"


def load_actions() -> list[dict]:
    return yaml.safe_load(POLICY_PATH.read_text())["actions"]


def _base_eligibility(code: str, context: dict) -> tuple[bool, str | None]:
    """Evaluate the `requires` gate for one action code. Returns (eligible, rejection_reason)."""
    if code == "in_app_education":
        if context["open_critical_tickets"] > 0:
            return False, "Severe open ticket — escalate first"
        return True, None
    if code == "payment_retry":
        # Safety gate: payment_retry must NEVER be eligible without real
        # payment-failure evidence pulled from payment_events.
        if not context["payment_failure_evidence"]:
            return False, "No payment-failure evidence"
        return True, None
    if code == "support_escalation":
        if context["open_critical_tickets"] == 0 and context["open_high_tickets"] < 2:
            return False, "No severe issue evidence"
        return True, None
    if code == "human_outreach":
        if not context.get("contact_allowed", True):
            return False, "Contact not allowed"
        return True, None
    if code == "plan_review":
        if not (context["plan_utilization_low"] or context["price_objection"]):
            return False, "No plan/price signal"
        return True, None
    if code == "pause_subscription":
        if not context["lifecycle_evidence"]:
            return False, "No lifecycle evidence"
        return True, None
    if code == "upgrade_review":
        # Safety gate: upgrade_review must NEVER be eligible when experience
        # is low, regardless of expansion signal. Checked first (ahead of
        # expansion_readiness_high) so the rejection reason always names the
        # failing safety condition explicitly when experience is the blocker.
        if context["experience_score"] < 70:
            return False, "Experience score is below 70 — account experience is too poor for upsell outreach"
        if not context["expansion_readiness_high"]:
            return False, "Expansion readiness not high"
        return True, None
    if code == "no_action":
        return True, None
    return False, f"Unknown action code: {code}"


def _max_window(action: dict) -> tuple[int, int] | None:
    """Parse an action's `max_per_Nd` policy key into (max_count, window_days)."""
    for key, val in action.items():
        if key.startswith("max_per_") and key.endswith("d"):
            days = int(key[len("max_per_"):-1])
            return int(val), days
    return None


def _frequency_cap_hit(db: Client, account_id: str, code: str, action: dict) -> tuple[bool, int, int]:
    """Count prior eligible recommendations of this code for this account within
    the policy's rolling window. Returns (hit, max_count, window_days)."""
    window = _max_window(action)
    if not window:
        return False, 0, 0
    max_count, days = window
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = (
        db.table("action_recommendations")
        .select("id")
        .eq("account_id", account_id)
        .eq("action_code", code)
        .eq("eligibility", True)
        .gte("generated_at", cutoff)
        .execute()
        .data
    )
    return len(rows) >= max_count, max_count, days


def check_eligibility(db: Client, account_id: str, action: dict, context: dict) -> tuple[bool, str | None]:
    """Return (eligible, rejection_reason). Combines the action's `requires`
    gate with a frequency cap so an action already recommended too many times
    recently cannot keep firing even once its base condition is satisfied."""
    code = action["code"]
    eligible, reason = _base_eligibility(code, context)
    if eligible:
        hit, max_count, days = _frequency_cap_hit(db, account_id, code, action)
        if hit:
            return False, f"Frequency cap reached: max {max_count} per {days}d"
    return eligible, reason
