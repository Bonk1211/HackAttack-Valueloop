import random
from datetime import datetime, timedelta

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


@router.get("/dashboard/trend")
def trend(months: int = 6, db: Client = Depends(get_db)):
    accounts = db.table("accounts").select("arr_mrr").execute().data or []
    current_mrr = sum(a["arr_mrr"] for a in accounts)
    result = []
    for i in range(months):
        # Synthetic: current MRR with slight historical variation
        factor = 1.0 - (months - 1 - i) * 0.03 + random.uniform(-0.02, 0.02)
        month_date = datetime.now() - timedelta(days=30 * (months - 1 - i))
        result.append({
            "month": month_date.strftime("%Y-%m"),
            "mrr": round(current_mrr * factor, 2),
        })
    return envelope(data=result)


@router.get("/dashboard/action-mix")
def action_mix(db: Client = Depends(get_db)):
    recs = db.table("action_recommendations").select("action_code, eligibility").execute().data or []
    counts = {}
    for r in recs:
        code = r["action_code"]
        if code not in counts:
            counts[code] = {"eligible": 0, "rejected": 0}
        if r["eligibility"]:
            counts[code]["eligible"] += 1
        else:
            counts[code]["rejected"] += 1
    result = [
        {"name": code, "eligible": v["eligible"], "rejected": v["rejected"]}
        for code, v in sorted(counts.items())
    ]
    return envelope(data=result)
