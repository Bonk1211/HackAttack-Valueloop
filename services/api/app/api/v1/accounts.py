from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.customer360 import assemble_profile

router = APIRouter()

@router.get("/accounts")
def list_accounts(db: Client = Depends(get_db)):
    rows = db.table("accounts").select("*").order("arr_mrr", desc=True).execute()
    return envelope(data=rows.data)

@router.get("/accounts/{account_id}")
def get_account(account_id: str, db: Client = Depends(get_db)):
    return envelope(data=assemble_profile(db, account_id))
