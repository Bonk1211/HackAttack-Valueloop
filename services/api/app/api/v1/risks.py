from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.risk import predict_risks

router = APIRouter()

@router.get("/accounts/{account_id}/risks")
def get_risks(account_id: str, db: Client = Depends(get_db)):
    preds = predict_risks(db, account_id)
    return envelope(data=[p.model_dump(mode="json") for p in preds])
