from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.health import score_health

router = APIRouter()

@router.get("/accounts/{account_id}/health")
def get_health(account_id: str, db: Client = Depends(get_db)):
    return envelope(data=score_health(db, account_id).model_dump(mode="python"))
