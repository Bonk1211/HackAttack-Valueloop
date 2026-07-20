from datetime import datetime, timezone
from supabase import Client
from app.models import Outcome
from app.core.errors import NotFound, ValidationError

# Outcome can only be recorded once a decision has been made (approved/executed)
# or already delivered (idempotent re-record).
OUTCOME_ELIGIBLE_STATUSES = ("approved", "executed", "delivered")


def record_outcome(
    db: Client,
    intervention_id: str,
    *,
    renewed: bool | None = None,
    downgraded: bool | None = None,
    churned: bool | None = None,
    usage_delta: float | None = None,
    health_delta: float | None = None,
    response: str | None = None,
    observation: str | None = None,
) -> Outcome:
    row = db.table("interventions").select("*").eq("id", intervention_id).maybe_single().execute()
    if not row or not row.data:
        raise NotFound("intervention", intervention_id)
    current = row.data["status"]
    if current not in OUTCOME_ELIGIBLE_STATUSES:
        raise ValidationError(
            f"Cannot record outcome for intervention in '{current}' status"
        )
    out = Outcome(
        intervention_id=intervention_id,
        renewed=renewed,
        downgraded=downgraded,
        churned=churned,
        usage_delta=usage_delta,
        health_delta=health_delta,
        response=response,
        observation=observation,
        recorded_at=datetime.now(timezone.utc),
    )
    db.table("outcomes").insert(out.model_dump(mode="json")).execute()
    db.table("interventions").update({
        "status": "delivered",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", intervention_id).execute()
    return out
