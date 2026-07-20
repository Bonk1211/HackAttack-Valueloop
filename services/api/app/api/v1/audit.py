from fastapi import APIRouter, Depends, Query
from typing import Optional
from supabase import Client
from app.deps import get_db
from app.models import envelope

router = APIRouter()


@router.get("/audit")
def list_audit(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    limit: int = Query(default=100, le=1000),
    db: Client = Depends(get_db),
):
    q = db.table("audit_logs").select("*")
    if entity_type:
        q = q.eq("entity_type", entity_type)
    if entity_id:
        q = q.eq("entity_id", entity_id)
    if actor_id:
        q = q.eq("actor_id", actor_id)
    result = q.order("timestamp", desc=True).limit(limit).execute()
    return envelope(data=result.data or [])
