from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.causes import generate_hypotheses

router = APIRouter()

@router.get("/accounts/{account_id}/causes")
def get_causes(account_id: str, db: Client = Depends(get_db)):
    hyps = generate_hypotheses(db, account_id)
    return envelope(data=[h.model_dump(mode="json") for h in hyps])
