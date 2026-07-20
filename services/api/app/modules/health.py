from datetime import datetime, timezone
from supabase import Client
from app.models import HealthScore
from app.modules.customer360 import assemble_profile

WEIGHTS = {"adoption": 0.25, "engagement": 0.20, "experience": 0.20, "financial": 0.20, "value": 0.15}

def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))

def _adoption_score(usage: list[dict]) -> float:
    if not usage: return 50.0
    core = [e for e in usage if e["feature"] == "core_workflow"]
    if not core: return 40.0
    # baseline: 0.5 core-feature events/day over the last 30 days. Core-workflow
    # events are one of several feature categories logged per account, so a
    # healthy account naturally spends only a fraction of its daily activity
    # there — a 1-event/day baseline would floor every real seeded account.
    recent = [e for e in core if _parse_ts(e["timestamp"]) > _now() - _days(30)]
    daily_rate = len(recent) / 30
    return _clamp(daily_rate / 0.5 * 80 + 20)

def _engagement_score(usage: list[dict]) -> float:
    if not usage: return 50.0
    days = {_parse_ts(e["timestamp"]).date() for e in usage}
    active_days = len(days)
    return _clamp(active_days / 30 * 100)

def _experience_score(tickets: list[dict]) -> float:
    score = 100.0
    open_tickets = [t for t in tickets if not t.get("closed_at")]
    for t in open_tickets:
        sev = t.get("severity")
        # Unresolved critical/high severity tickets are weighted heavily —
        # a single open critical incident should already push an account
        # into the "poor" experience tier on its own.
        if sev == "critical": score -= 40
        elif sev == "high": score -= 25
        elif sev == "medium": score -= 12
        else: score -= 5
    return _clamp(score)

def _financial_score(payments: list[dict]) -> float:
    if not payments: return 80.0
    recent = sorted(payments, key=lambda p: p["timestamp"], reverse=True)[:5]
    # Percentage of recent attempts that failed, not a flat per-failure
    # deduction — a flat deduction implicitly assumes a fixed pool of 5
    # attempts, which under-weights failures when fewer payments exist.
    failure_rate = sum(1 for p in recent if p["status"] == "failed") / len(recent)
    return _clamp(100 - failure_rate * 100)

def _value_score(feedback: list[dict]) -> float:
    if not feedback: return 60.0
    csat = [f for f in feedback if f["metric_type"] == "csat" and f.get("score") is not None]
    if not csat: return 60.0
    avg = sum(f["score"] for f in csat) / len(csat)
    return _clamp(avg * 10)  # assume CSAT is 0-10

def _now():
    return datetime.now(timezone.utc)

def _days(n: int):
    from datetime import timedelta
    return timedelta(days=n)

def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

def score_health(db: Client, account_id: str) -> HealthScore:
    assemble_profile(db, account_id)
    usage = db.table("usage_events").select("*").eq("account_id", account_id).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data

    dims = {
        "adoption": _adoption_score(usage),
        "engagement": _engagement_score(usage),
        "experience": _experience_score(tickets),
        "financial": _financial_score(payments),
        "value": _value_score(feedback),
    }
    overall = sum(dims[k] * WEIGHTS[k] for k in WEIGHTS)
    hs = HealthScore(
        account_id=account_id,
        generated_at=datetime.now(timezone.utc),
        adoption=round(dims["adoption"], 1),
        engagement=round(dims["engagement"], 1),
        experience=round(dims["experience"], 1),
        financial=round(dims["financial"], 1),
        value=round(dims["value"], 1),
        overall=round(overall, 1),
        version="1.0",
    )
    # persist snapshot (mode="json" so datetime/etc. serialize for the postgrest HTTP layer)
    db.table("health_scores").insert(hs.model_dump(exclude={"id"}, mode="json")).execute()
    return hs
