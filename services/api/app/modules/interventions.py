import secrets
from datetime import datetime, timezone
from supabase import Client
from app.models import Intervention, AuditLog
from app.core.errors import NotFound, ValidationError

VALID_TRANSITIONS = {
    "pending": ["approved", "rejected", "modified"],
    "approved": ["executed", "rejected"],
    "modified": ["approved", "rejected"],
    "executed": ["delivered"],
    "delivered": [],
    "rejected": [],
}


def create_intervention(db: Client, account_id: str, recommended_action: str, actor_id: str, actor_role: str = "system") -> Intervention:
    iid = f"int-{secrets.token_hex(4)}"
    rec = Intervention(
        id=iid,
        account_id=account_id,
        recommended_action=recommended_action,
        status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.table("interventions").insert(rec.model_dump(mode="json")).execute()
    _audit(db, actor_id, actor_role, "create_intervention", "intervention", iid, None, rec.model_dump(mode="json"))
    return rec


def transition(db: Client, intervention_id: str, new_status: str, actor_id: str, actor_role: str, reason: str | None = None, final_action: str | None = None) -> Intervention:
    row = db.table("interventions").select("*").eq("id", intervention_id).maybe_single().execute()
    if not row or not row.data:
        raise NotFound("intervention", intervention_id)
    before = row.data
    current = before["status"]
    if new_status not in VALID_TRANSITIONS.get(current, []):
        raise ValidationError(f"Cannot transition from {current} to {new_status}")
    update = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if new_status in ("approved", "executed"):
        update["final_action"] = final_action or before["recommended_action"]
        update["approver"] = actor_id
    if reason:
        update["reason"] = reason
    db.table("interventions").update(update).eq("id", intervention_id).execute()
    after = db.table("interventions").select("*").eq("id", intervention_id).maybe_single().execute().data
    _audit(db, actor_id, actor_role, f"intervention_{new_status}", "intervention", intervention_id, before, after, reason)
    return Intervention(**after)


def _audit(db: Client, actor_id: str, actor_role: str, action: str, entity_type: str, entity_id: str, before, after, reason: str | None = None):
    db.table("audit_logs").insert({
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before_json": before,
        "after_json": after,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
    }).execute()
