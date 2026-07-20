from fastapi import APIRouter, Depends, Query
from supabase import Client
from app.deps import get_db
from app.models import envelope

router = APIRouter()


@router.get("/audit")
def list_audit(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    db: Client = Depends(get_db),
):
    result = (
        db.table("audit_logs")
        .select("*")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("timestamp", desc=False)
        .execute()
    )
    return envelope(data=result.data or [])
