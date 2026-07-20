from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.risk import predict_risks

router = APIRouter()


@router.get("/accounts/{account_id}/risks")
def get_risks(account_id: str, db: Client = Depends(get_db)):
    preds = predict_risks(db, account_id)
    return envelope(data=[p.model_dump(mode="json") for p in preds])


@router.get("/accounts/{account_id}/risk-history")
def risk_history(account_id: str, days: int = Query(7, ge=1, le=90), db: Client = Depends(get_db)):
    rows = (
        db.table("risk_predictions")
        .select("*")
        .eq("account_id", account_id)
        .order("generated_at", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )

    if not rows:
        # No historical data — compute current and return synthetic flat line
        current = predict_risks(db, account_id, persist=False)
        today = datetime.now(timezone.utc)
        result = []
        for i in range(days):
            day = today - timedelta(days=days - 1 - i)
            result.append({
                "date": day.strftime("%Y-%m-%d"),
                "risks": [r.model_dump(mode="json") for r in current],
            })
        return envelope(data=result)

    # Group by date
    by_date: dict[str, list] = {}
    for row in rows:
        date = row["generated_at"][:10]  # YYYY-MM-DD
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(row)

    result = [
        {"date": date, "risks": risks}
        for date, risks in sorted(by_date.items(), reverse=True)[:days]
    ]
    return envelope(data=result)
