from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.customer360 import assemble_profile

router = APIRouter()

@router.get("/accounts")
def list_accounts(include: str | None = None, db: Client = Depends(get_db)):
    accounts = db.table("accounts").select("*").order("arr_mrr", desc=True).execute().data or []
    if include == "analysis":
        from app.modules.health import score_health
        from app.modules.risk import predict_risks
        from app.modules.causes import generate_hypotheses
        from app.modules.actions import recommend_actions
        for acc in accounts:
            try:
                health = score_health(db, acc["id"])
                risks = predict_risks(db, acc["id"], persist=False)
                causes = generate_hypotheses(db, acc["id"])
                actions = recommend_actions(db, acc["id"], health=health, risks=risks)
                acc["analysis"] = {
                    "health": health.model_dump(mode="json"),
                    "risks": [r.model_dump(mode="json") for r in risks],
                    "causes": [c.model_dump(mode="json") for c in causes],
                    "actions": [a.model_dump(mode="json") for a in actions],
                }
            except Exception:
                # Skip accounts that fail analysis (FK violations, etc.)
                # This is a hackathon MVP — perfect coverage isn't required
                continue
    return envelope(data=accounts)

@router.get("/accounts/{account_id}")
def get_account(account_id: str, db: Client = Depends(get_db)):
    return envelope(data=assemble_profile(db, account_id))
