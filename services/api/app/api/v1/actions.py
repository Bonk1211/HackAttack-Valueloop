from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.actions import recommend_actions

router = APIRouter()

@router.get("/accounts/{account_id}/actions")
def get_actions(account_id: str, db: Client = Depends(get_db)):
    recs = recommend_actions(db, account_id)
    return envelope(data=[r.model_dump(mode="json") for r in recs])
