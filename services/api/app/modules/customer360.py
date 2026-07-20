from datetime import datetime, timezone
from supabase import Client
from app.core.errors import NotFound

def assemble_profile(db: Client, account_id: str) -> dict:
    acct = db.table("accounts").select("*").eq("id", account_id).maybe_single().execute()
    if not acct or not acct.data:
        raise NotFound("account", account_id)
    sub = db.table("subscriptions").select("*").eq("account_id", account_id).order("created_at", desc=True).limit(1).execute()
    users = db.table("users").select("*").eq("account_id", account_id).execute()
    usage = db.table("usage_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).limit(50).execute()
    payments = db.table("payment_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).limit(20).execute()
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).order("opened_at", desc=True).limit(20).execute()
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).limit(20).execute()
    freshness = compute_freshness(usage.data, payments.data, tickets.data, feedback.data)
    return {
        "account": acct.data,
        "subscription": sub.data[0] if sub.data else None,
        "users": users.data,
        "freshness": freshness,
        "data_quality": score_data_quality(acct.data, usage.data, tickets.data),
    }

def compute_freshness(usage, payments, tickets, feedback) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    def rel(rows, ts_field):
        if not rows:
            return "no data"
        latest = max(datetime.fromisoformat(r[ts_field].replace("Z","+00:00")) for r in rows)
        mins = int((now - latest).total_seconds() // 60)
        if mins < 60: return f"{mins} min ago"
        if mins < 1440: return f"{mins // 60} hr ago"
        return f"{mins // 1440} days ago"
    return {
        "product_usage": rel(usage, "timestamp"),
        "billing": rel(payments, "timestamp"),
        "support": rel(tickets, "opened_at"),
        "feedback": rel(feedback, "timestamp"),
    }

def score_data_quality(acct, usage, tickets) -> float:
    score = 100.0
    if not usage: score -= 30
    if not tickets: score -= 10
    if not acct.get("owner_id"): score -= 20
    return max(0.0, score)

def build_timeline(db: Client, account_id: str) -> list[dict]:
    acct = db.table("accounts").select("id").eq("id", account_id).maybe_single().execute()
    if not acct or not acct.data:
        raise NotFound("account", account_id)
    def _row(kind, r, ts_field, title_field, meta):
        return {"kind": kind, "timestamp": r[ts_field], "title": r[title_field], "meta": meta, "raw": r}
    usage = db.table("usage_events").select("*").eq("account_id", account_id).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    events = []
    for r in usage:    events.append(_row("usage", r, "timestamp", "feature", f"count={r['count']}"))
    for r in payments: events.append(_row("payment", r, "timestamp", "status", f"amount={r['amount']}"))
    for r in tickets:  events.append(_row("support", r, "opened_at", "category", f"severity={r['severity']}"))
    for r in feedback: events.append(_row("feedback", r, "timestamp", "metric_type", f"score={r.get('score')}"))
    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events
