from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.customer360 import build_timeline

router = APIRouter()

@router.get("/accounts/{account_id}/timeline")
def get_timeline(account_id: str, db: Client = Depends(get_db)):
    return envelope(data=build_timeline(db, account_id))
