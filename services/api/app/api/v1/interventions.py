from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.interventions import create_intervention, transition
from app.modules.outcomes import record_outcome

router = APIRouter()


class CreateInterventionRequest(BaseModel):
    account_id: str
    recommended_action: str
    actor_id: str = "csm-demo"
    actor_role: str = "csm"


class TransitionRequest(BaseModel):
    status: str
    actor_id: str = "csm-demo"
    actor_role: str = "csm"
    reason: str | None = None
    final_action: str | None = None


class OutcomeRequest(BaseModel):
    renewed: bool | None = None
    downgraded: bool | None = None
    churned: bool | None = None
    usage_delta: float | None = None
    health_delta: float | None = None
    response: str | None = None
    observation: str | None = None


@router.get("/interventions")
def list_interventions(
    status: str | None = None,
    account_id: str | None = None,
    db: Client = Depends(get_db),
):
    q = db.table("interventions").select("*")
    if status:
        q = q.eq("status", status)
    if account_id:
        q = q.eq("account_id", account_id)
    result = q.order("created_at", desc=True).execute()
    return envelope(data=result.data or [])


@router.post("/interventions")
def create(req: CreateInterventionRequest, db: Client = Depends(get_db)):
    return envelope(
        data=create_intervention(
            db, req.account_id, req.recommended_action, req.actor_id, req.actor_role
        ).model_dump(mode="json")
    )


@router.patch("/interventions/{intervention_id}")
def update(intervention_id: str, req: TransitionRequest, db: Client = Depends(get_db)):
    return envelope(
        data=transition(
            db, intervention_id, req.status, req.actor_id, req.actor_role, req.reason, req.final_action
        ).model_dump(mode="json")
    )


@router.post("/interventions/{intervention_id}/outcome")
def add_outcome(intervention_id: str, req: OutcomeRequest, db: Client = Depends(get_db)):
    return envelope(
        data=record_outcome(db, intervention_id, **req.model_dump()).model_dump(mode="json")
    )
