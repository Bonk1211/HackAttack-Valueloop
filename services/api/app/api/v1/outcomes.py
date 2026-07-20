from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope

router = APIRouter()


@router.get("/outcomes")
def list_outcomes(
    intervention_id: str | None = None,
    db: Client = Depends(get_db),
):
    q = db.table("outcomes").select("*")
    if intervention_id:
        q = q.eq("intervention_id", intervention_id)
    result = q.order("recorded_at", desc=True).execute()
    return envelope(data=result.data or [])
