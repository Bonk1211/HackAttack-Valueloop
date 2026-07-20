from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.risk import predict_risks

router = APIRouter()

@router.get("/dashboard/kpis")
def kpis(db: Client = Depends(get_db)):
    accounts = db.table("accounts").select("*").execute().data or []
    total = len(accounts)

    # Compute risks on-the-fly for all accounts (since risk_predictions is wiped between tests)
    # Use persist=False to avoid inserting 250 rows per dashboard request.
    at_risk_ids = set()
    for account in accounts:
        risks = predict_risks(db, account["id"], persist=False)
        for r in risks:
            if r.risk_type == "cancellation" and r.probability > 0.6:
                at_risk_ids.add(account["id"])
                break

    at_risk_mrr = sum(a["arr_mrr"] for a in accounts if a["id"] in at_risk_ids)

    interventions = db.table("interventions").select("status").execute().data or []
    total_int = len(interventions)
    approved_executed = sum(1 for i in interventions if i["status"] in ("approved", "executed", "delivered"))
    modified = sum(1 for i in interventions if i["status"] == "modified")
    acceptance = (approved_executed / total_int) if total_int else 0.0
    override = (modified / total_int) if total_int else 0.0

    return envelope(data={
        "total_accounts": total,
        "at_risk_mrr": at_risk_mrr,
        "intervention_acceptance_rate": acceptance,
        "override_rate": override,
    })
