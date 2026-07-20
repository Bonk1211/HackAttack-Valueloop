import random
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from supabase import Client
from app.core.db import new_supabase
from app.deps import get_db
from app.models import envelope
from app.modules.risk import predict_risks

router = APIRouter()

@router.get("/dashboard/kpis")
def kpis(db: Client = Depends(get_db)):
    accounts = db.table("accounts").select("*").execute().data or []
    total = len(accounts)

    # Compute risks on-the-fly for all accounts (since risk_predictions is wiped between tests).
    # Use persist=False to avoid inserting 250 rows per dashboard request.
    # Each account does ~4 sequential Supabase HTTP calls (~1s) — run accounts
    # in parallel threads (I/O-bound, GIL releases during the HTTP call) so 50
    # accounts take ~1s instead of ~50s. Each thread gets its own client: the
    # shared client's HTTP/2 connection isn't safe under concurrent use.
    def _cancel_risk(account_id: str) -> bool:
        risks = predict_risks(new_supabase(), account_id, persist=False)
        return any(r.risk_type == "cancellation" and r.probability > 0.6 for r in risks)

    at_risk_ids = set()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = pool.map(_cancel_risk, [a["id"] for a in accounts])
        for account, is_at_risk in zip(accounts, results):
            if is_at_risk:
                at_risk_ids.add(account["id"])

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
def trend(months: int = Query(6, ge=1, le=24), db: Client = Depends(get_db)):
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
