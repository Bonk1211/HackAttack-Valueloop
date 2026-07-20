#!/usr/bin/env python3
"""Deterministic seed for ValueLoop demo. Idempotent — wipes and re-inserts.

Run from repo root:
    source services/api/.venv/bin/activate
    python scripts/seed_demo.py

Also writes the deterministic dataset to data/seeds/*.csv as a
human-reviewable, git-tracked artifact (source of truth is this script;
the CSVs are its deterministic output, regenerated on every run).
"""
import csv
import itertools
import random
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services/api"))

# Load services/api/.env explicitly — this script is invoked with the repo
# root as CWD, so pydantic-settings' relative env_file=".env" lookup (which
# resolves against CWD) would otherwise miss it.
from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "services/api/.env")

from app.core.db import get_supabase  # noqa: E402

SEED = 42
NOW = datetime.now(timezone.utc)
DATA_DIR = ROOT / "data/seeds"


def iso_days_ago(n: float) -> str:
    return (NOW - timedelta(days=n)).isoformat()


# ---------------------------------------------------------------------------
# 9 named fixtures — mirrors apps/web/lib/mock-data.ts `accounts[]`.
# Field values (plan/segment/arr_mrr/dates) are taken verbatim from the task
# brief's Step 1 CSV content; these IDs are referenced by frontend fixtures
# and downstream backend tests and must not change.
# ---------------------------------------------------------------------------
NAMED_ACCOUNTS = [
    {"id": "northstar", "name": "Northstar Labs", "initials": "NL", "owner_id": "aisha", "plan": "Scale", "segment": "Enterprise", "industry": "B2B analytics", "arr_mrr": 8200, "start_date": "2025-08-12", "renewal_date": "2026-08-12"},
    {"id": "harborline", "name": "Harborline Ops", "initials": "HO", "owner_id": "mei", "plan": "Growth", "segment": "Growth", "industry": "Logistics", "arr_mrr": 4800, "start_date": "2025-09-03", "renewal_date": "2026-09-03"},
    {"id": "forgeworks", "name": "Forgeworks Studio", "initials": "FS", "owner_id": "daniel", "plan": "Growth", "segment": "Growth", "industry": "Manufacturing", "arr_mrr": 5100, "start_date": "2025-09-21", "renewal_date": "2026-09-21"},
    {"id": "lumen", "name": "LumenWorks", "initials": "LW", "owner_id": "mei", "plan": "Growth", "segment": "Growth", "industry": "Creative services", "arr_mrr": 4100, "start_date": "2025-09-19", "renewal_date": "2026-09-19"},
    {"id": "ember", "name": "Ember Commerce", "initials": "EC", "owner_id": "daniel", "plan": "Growth", "segment": "Growth", "industry": "Commerce", "arr_mrr": 5600, "start_date": "2025-07-28", "renewal_date": "2026-07-28"},
    {"id": "cobalt", "name": "Cobalt Systems", "initials": "CS", "owner_id": "aisha", "plan": "Scale", "segment": "Enterprise", "industry": "Cybersecurity", "arr_mrr": 9100, "start_date": "2025-10-11", "renewal_date": "2026-10-11"},
    {"id": "meridian", "name": "Meridian Cloud", "initials": "MC", "owner_id": "aisha", "plan": "Scale", "segment": "Enterprise", "industry": "Cloud operations", "arr_mrr": 7900, "start_date": "2025-09-04", "renewal_date": "2026-09-04"},
    {"id": "willow", "name": "Willow Health", "initials": "WH", "owner_id": "mei", "plan": "Team", "segment": "Team", "industry": "Health services", "arr_mrr": 3200, "start_date": "2025-10-17", "renewal_date": "2026-10-17"},
    {"id": "atlas", "name": "Atlas Robotics", "initials": "AR", "owner_id": "daniel", "plan": "Scale", "segment": "Enterprise", "industry": "Robotics", "arr_mrr": 9400, "start_date": "2025-11-02", "renewal_date": "2026-11-02"},
]
NAMED_IDS = {a["id"] for a in NAMED_ACCOUNTS}

# ---------------------------------------------------------------------------
# Fixed pools for generated accounts
# ---------------------------------------------------------------------------
PLANS = ["Team", "Growth", "Scale"]
SEGMENTS = ["Team", "Growth", "Enterprise"]
INDUSTRIES = ["Analytics", "Logistics", "Healthcare", "Finance", "Retail", "Manufacturing", "SaaS", "Education"]
OWNERS = ["aisha", "mei", "daniel"]
ADJECTIVES = ["Summit", "River", "Cedar", "Iron", "Bright", "North", "South", "East", "West", "Stone", "Harbor", "Oak", "Pine", "Copper", "Silver", "Golden"]
NOUNS = ["Labs", "Works", "Systems", "Solutions", "Group", "Partners", "Industries", "Analytics", "Studio", "Commerce", "Cloud", "Health", "Robotics", "Ops"]

FEATURES = ["core_workflow", "dashboard", "reports", "exports", "settings"]

# CONCERN (deliberate deviation from brief skeleton): the brief's
# CAUSE_BUCKETS = ["payment"]*10 + ["technical"]*10 + ["adoption"]*10 +
# ["price"]*10 + ["normal"]*10 sums to 50 but there are only 41 *generated*
# accounts (9 are named fixtures with their own hand-picked patterns). To
# satisfy "at least 10 accounts per cause pattern" across the full 50-account
# set, the 9 named accounts are tallied into the taxonomy below (northstar->
# technical, harborline/forgeworks/willow->adoption, lumen/cobalt->price,
# ember->payment, meridian/atlas->normal) and the 41 generated accounts fill
# the remainder: payment 9, technical 9, adoption 7, price 8, normal 8 — each
# bucket totals exactly 10 once the named accounts are included.
CAUSE_BUCKETS = ["payment"] * 9 + ["technical"] * 9 + ["adoption"] * 7 + ["price"] * 8 + ["normal"] * 8


def generate_accounts(rng: random.Random):
    """Deterministically generate the 41 non-named accounts + their cause bucket."""
    combos = list(itertools.product(ADJECTIVES, NOUNS))
    rng.shuffle(combos)
    chosen = combos[:41]

    bucket_pool = list(CAUSE_BUCKETS)
    rng.shuffle(bucket_pool)

    accounts, gen_bucket, gen_pos = [], {}, {}
    bucket_counters: dict[str, int] = {}
    used_ids = set(NAMED_IDS)

    for (adj, noun), bucket in zip(chosen, bucket_pool):
        base_id = f"{adj.lower()}-{noun.lower()}"
        acc_id, suffix = base_id, 2
        while acc_id in used_ids:
            acc_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(acc_id)

        start = (NOW - timedelta(days=rng.randint(45, 420))).date()
        accounts.append({
            "id": acc_id,
            "name": f"{adj} {noun}",
            "initials": (adj[0] + noun[0]).upper(),
            "owner_id": rng.choice(OWNERS),
            "plan": rng.choice(PLANS),
            "segment": rng.choice(SEGMENTS),
            "industry": rng.choice(INDUSTRIES),
            "arr_mrr": rng.randint(1500, 9800),
            "start_date": start.isoformat(),
            "renewal_date": (start + timedelta(days=365)).isoformat(),
        })
        gen_bucket[acc_id] = bucket
        pos = bucket_counters.get(bucket, 0)
        gen_pos[acc_id] = pos
        bucket_counters[bucket] = pos + 1

    return accounts, gen_bucket, gen_pos


# ---------------------------------------------------------------------------
# Row builders — every table's shape below matches
# services/api/supabase/migrations/20260719183128_00001_initial_schema.sql
# ---------------------------------------------------------------------------
def gen_users(account_id: str, rng: random.Random, n: int, inactive_count: int) -> list[dict]:
    roles = ["admin"] + [rng.choice(["member", "viewer", "manager"]) for _ in range(n - 1)]
    rows = []
    for i in range(n):
        status = "inactive" if i >= n - inactive_count else "active"
        rows.append({"id": f"u-{account_id}-{i + 1}", "account_id": account_id, "role": roles[i], "seat_status": status})
    return rows


def gen_subscription(account: dict, status: str) -> dict:
    return {
        "id": f"sub-{account['id']}",
        "account_id": account["id"],
        "plan": account["plan"],
        "price": float(account["arr_mrr"]),
        "status": status,
        "renewal_date": account["renewal_date"],
        "cancel_at": None,
    }


def gen_usage_events(account_id: str, rng: random.Random, user_ids: list[str],
                      recent_count: int, older_count: int, recent_days: int, day_range: int,
                      feature_weights: dict | None) -> list[dict]:
    weights = feature_weights or {f: 1 for f in FEATURES}
    feats, wts = list(weights.keys()), list(weights.values())
    rows, idx = [], 0

    def build(n: int, lo: float, hi: float):
        nonlocal idx
        for _ in range(n):
            idx += 1
            day_off = rng.uniform(lo, hi)
            ts = NOW - timedelta(days=day_off, hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
            rows.append({
                "id": f"ue-{account_id}-{idx:04d}",
                "account_id": account_id,
                "user_id": rng.choice(user_ids) if user_ids else None,
                "feature": rng.choices(feats, weights=wts, k=1)[0],
                "timestamp": ts.isoformat(),
                "count": rng.randint(1, 12),
                "duration": round(rng.uniform(0.5, 45.0), 2),
            })

    build(recent_count, 0, recent_days)
    build(older_count, recent_days, day_range)
    return rows


def gen_payment_events(account_id: str, specs: list[tuple]) -> list[dict]:
    rows = []
    for i, (day_off, status, code, attempt, amount) in enumerate(specs, start=1):
        ts = NOW - timedelta(days=day_off)
        rows.append({
            "id": f"pe-{account_id}-{i:02d}", "account_id": account_id, "timestamp": ts.isoformat(),
            "status": status, "amount": float(amount), "attempt": attempt, "failure_code": code,
        })
    return rows


def gen_support_tickets(account_id: str, specs: list[tuple]) -> list[dict]:
    rows = []
    for i, (open_off, resolve_after, sev, cat, sentiment) in enumerate(specs, start=1):
        opened = NOW - timedelta(days=open_off)
        closed = opened + timedelta(days=resolve_after) if resolve_after is not None else None
        rows.append({
            "id": f"tk-{account_id}-{i:02d}", "account_id": account_id, "severity": sev, "category": cat,
            "opened_at": opened.isoformat(), "closed_at": closed.isoformat() if closed else None,
            "sentiment": sentiment, "resolution": "Resolved" if closed else None,
        })
    return rows


def gen_feedback_events(account_id: str, specs: list[tuple]) -> list[dict]:
    rows = []
    for i, (day_off, metric, score, text) in enumerate(specs, start=1):
        ts = NOW - timedelta(days=day_off)
        rows.append({
            "id": f"fb-{account_id}-{i:02d}", "account_id": account_id, "metric_type": metric,
            "score": float(score) if score is not None else None, "text": text, "timestamp": ts.isoformat(),
        })
    return rows


def build_bundle(account: dict, cfg: dict, rng: random.Random):
    n_users, inactive_count = cfg["users"]
    users = gen_users(account["id"], rng, n_users, inactive_count)
    active_ids = [u["id"] for u in users if u["seat_status"] == "active"] or [u["id"] for u in users]
    subscription = gen_subscription(account, cfg["subscription_status"])
    recent_count, older_count, recent_days, day_range, feature_weights = cfg["usage"]
    usage = gen_usage_events(account["id"], rng, active_ids, recent_count, older_count, recent_days, day_range, feature_weights)
    payments = gen_payment_events(account["id"], cfg["payments"])
    tickets = gen_support_tickets(account["id"], cfg["tickets"])
    feedback = gen_feedback_events(account["id"], cfg["feedback"])
    return users, subscription, usage, payments, tickets, feedback


# ---------------------------------------------------------------------------
# Named-fixture event configs — hand-tuned to reproduce the qualitative
# signals described in apps/web/lib/mock-data.ts churnProfiles[]. usage is
# (recent_count, older_count, recent_days, day_range, feature_weights):
#   northstar: usage split 6/24 over last 9d vs 9-30d ago -> ~42% activity-rate drop
#              (recent rate 0.67/day vs older 1.14/day = -42%), matching
#              "Usage fell 42% after the incident"; 2 unresolved critical/high
#              tickets; payments all succeeded (healthy).
#   ember: 2 failed payment_events (card_expired) + 1 healthy prior payment;
#          usage flat/healthy; 1 minor ticket resolved same day.
#   atlas: no tickets, all payments succeeded, usage weighted toward the
#          recent window (expansion-ready, low risk / high health).
#   willow: usage split 4/26 (~64% activity-rate drop, "Active days fell 61%"),
#           7 of 8 seats inactive, no tickets, payments healthy (silent churn).
# ---------------------------------------------------------------------------
NAMED_CONFIG = {
    "northstar": {
        "users": (6, 1), "subscription_status": "active",
        "usage": (6, 24, 9, 30, None),
        "payments": [(5, "succeeded", None, 1, 8200), (35, "succeeded", None, 1, 8200), (65, "succeeded", None, 1, 8200)],
        "tickets": [(6, None, "critical", "incident", "negative"), (3, None, "high", "bug", "negative")],
        "feedback": [(1, "verbatim", None, "Frustrated with unresolved incident affecting core workflow")],
    },
    "harborline": {
        "users": (5, 1), "subscription_status": "active",
        "usage": (10, 14, 9, 30, {"core_workflow": 1, "dashboard": 3, "reports": 3, "exports": 2, "settings": 2}),
        "payments": [(3, "succeeded", None, 1, 4800), (33, "succeeded", None, 1, 4800), (63, "succeeded", None, 1, 4800)],
        "tickets": [],
        "feedback": [(26 / 60, "csat", 8, "Training pace could be faster")],
    },
    "forgeworks": {
        "users": (5, 1), "subscription_status": "active",
        "usage": (12, 18, 9, 30, {"core_workflow": 2, "dashboard": 2, "reports": 2, "exports": 5, "settings": 1}),
        "payments": [(4, "succeeded", None, 1, 5100), (34, "succeeded", None, 1, 5100), (64, "succeeded", None, 1, 5100)],
        "tickets": [],
        "feedback": [(0.3, "verbatim", None, "Need a scenario-planning feature; exporting to finish forecasting externally")],
    },
    "lumen": {
        "users": (4, 1), "subscription_status": "active",
        "usage": (8, 14, 9, 30, None),
        "payments": [(2, "succeeded", None, 1, 4100), (32, "succeeded", None, 1, 4100), (62, "succeeded", None, 1, 4100)],
        "tickets": [],
        "feedback": [(0.7, "verbatim", None, "Renewal survey: price feels high relative to plan utilization"), (0.7, "nps", 4, None)],
    },
    "ember": {
        "users": (5, 1), "subscription_status": "active",
        "usage": (14, 24, 9, 30, None),
        "payments": [(35, "succeeded", None, 1, 5600), (4, "failed", "card_expired", 1, 5600), (2, "failed", "card_expired", 2, 5600)],
        "tickets": [(3, 0.75, "low", "access", "neutral")],
        "feedback": [(1 / 6, "csat", 9, "No issues besides the billing hiccup")],
    },
    "cobalt": {
        "users": (6, 1), "subscription_status": "active",
        "usage": (14, 18, 9, 30, {"core_workflow": 2, "dashboard": 2, "reports": 1, "exports": 4, "settings": 1}),
        "payments": [(6, "succeeded", None, 1, 9100), (36, "succeeded", None, 1, 9100), (66, "succeeded", None, 1, 9100)],
        "tickets": [],
        "feedback": [(0.2, "verbatim", None, "Evaluating a named competitor due to a missing policy-simulation feature")],
    },
    "meridian": {
        "users": (6, 4), "subscription_status": "active",
        "usage": (0, 26, 9, 30, None),
        "payments": [(4, "succeeded", None, 1, 7900), (34, "succeeded", None, 1, 7900), (64, "succeeded", None, 1, 7900)],
        "tickets": [],
        "feedback": [(0.08, "verbatim", None, "Implementation project complete; planning to resume in October")],
    },
    "willow": {
        "users": (8, 7), "subscription_status": "active",
        "usage": (4, 26, 9, 30, None),
        "payments": [(1, "succeeded", None, 1, 3200), (31, "succeeded", None, 1, 3200), (61, "succeeded", None, 1, 3200)],
        "tickets": [],
        "feedback": [(1 / 6, "nps", 5, None)],
    },
    "atlas": {
        "users": (7, 0), "subscription_status": "active",
        "usage": (22, 18, 9, 30, None),
        "payments": [(7, "succeeded", None, 1, 9400), (37, "succeeded", None, 1, 9400), (67, "succeeded", None, 1, 9400)],
        "tickets": [],
        "feedback": [(11 / 60, "nps", 9, "Ready to expand seats next quarter")],
    },
}


def bucket_spec(bucket: str, pos_in_bucket: int, rng: random.Random, account: dict) -> dict:
    """Randomized (deterministic given rng state) event config for a generated account.

    pos_in_bucket == 0 in every bucket is flagged "ambiguous" (adds one
    contradicting event) -> exactly 5 ambiguous accounts across the 5 buckets.
    The first 4 of 8 "normal" accounts are flavored "expansion-ready" -> with
    atlas (named), 5 expansion-positive accounts total.
    """
    ambiguous = pos_in_bucket == 0
    expansion = bucket == "normal" and pos_in_bucket < 4
    n_users = rng.randint(3, 8)
    amount = account["arr_mrr"]
    base_payments = [(rng.randint(2, 10) + 30 * i, "succeeded", None, 1, amount) for i in range(3)]

    if bucket == "payment":
        inactive = rng.randint(0, 1)
        usage_total = rng.randint(20, 34)
        older = round(usage_total * 0.55)
        recent = usage_total - older
        fail_n = rng.randint(1, 2)
        payments = [(rng.randint(30, 40), "succeeded", None, 1, amount)]
        payments += [(rng.randint(1, 6), "failed", rng.choice(["card_expired", "insufficient_funds", "card_declined"]), i + 1, amount) for i in range(fail_n)]
        tickets = [(rng.randint(2, 8), None, "low", "billing_question", "neutral")] if ambiguous else []
        feedback = [(rng.randint(1, 10), "csat", rng.randint(6, 9), None)]
        sub_status = rng.choice(["active", "active", "past_due"])
    elif bucket == "technical":
        inactive = rng.randint(0, 2)
        usage_total = rng.randint(20, 30)
        older = round(usage_total * 0.62)
        recent = usage_total - older
        payments = base_payments
        tickets = []
        for _ in range(rng.randint(1, 3)):
            sev = rng.choice(["critical", "high", "medium"])
            resolved = rng.random() < 0.4
            tickets.append((rng.randint(1, 20), rng.randint(1, 5) if resolved else None, sev, rng.choice(["bug", "performance", "incident"]), "negative"))
        feedback = [(rng.randint(1, 10), "verbatim", None, "Reported repeated issues with a core workflow")]
        if ambiguous:
            feedback.append((rng.randint(1, 5), "nps", rng.randint(7, 9), None))
        sub_status = "active"
    elif bucket == "adoption":
        inactive = rng.randint(1, max(1, n_users - 1))
        usage_total = rng.randint(20, 26)
        older = round(usage_total * 0.5)
        recent = usage_total - older
        payments = base_payments
        tickets = [(rng.randint(2, 8), rng.randint(1, 3), "medium", "training", "neutral")] if ambiguous else []
        feedback = [(rng.randint(1, 10), "csat", rng.randint(5, 7), None)]
        sub_status = "active"
    elif bucket == "price":
        inactive = rng.randint(0, 2)
        usage_total = rng.randint(20, 26)
        older = round(usage_total * 0.5)
        recent = usage_total - older
        payments = base_payments
        tickets = []
        feedback = [(rng.randint(1, 10), "verbatim", None, "Utilization is low relative to plan tier"), (rng.randint(1, 10), "nps", rng.randint(3, 6), None)]
        if ambiguous:
            feedback.append((rng.randint(1, 5), "csat", rng.randint(8, 9), None))
        sub_status = "active"
    else:  # normal
        inactive = rng.randint(0, 1)
        usage_total = rng.randint(30, 45) if expansion else rng.randint(24, 34)
        recent_frac = 0.55 if expansion else 0.3
        recent = round(usage_total * recent_frac)
        older = usage_total - recent
        payments = base_payments
        tickets = [(rng.randint(2, 8), None, "low", "bug", "neutral")] if ambiguous else []
        feedback = [(rng.randint(1, 10), "nps", rng.randint(8, 10) if expansion else rng.randint(6, 8), None)]
        sub_status = "active"

    return {
        "users": (n_users, inactive),
        "usage": (recent, older, 9, 30, None),
        "payments": payments,
        "tickets": tickets,
        "feedback": feedback,
        "subscription_status": sub_status,
    }


# ---------------------------------------------------------------------------
# 8 historical interventions + outcomes — statuses/channels per brief Step 4.
# ---------------------------------------------------------------------------
INTERVENTIONS = [
    {"id": "int-northstar-01", "account_id": "northstar", "recommended_action": "support_escalation", "final_action": "support_escalation", "approver": "aisha", "status": "executed", "channel": "task", "reason": "Resolve two unresolved severity-1 tickets before retention outreach.", "created_at": iso_days_ago(9), "updated_at": iso_days_ago(2)},
    {"id": "int-harborline-01", "account_id": "harborline", "recommended_action": "guided_onboarding", "final_action": "guided_onboarding", "approver": "mei", "status": "delivered", "channel": "email", "reason": "Only 1 of 5 success goals completed; run goal-led onboarding.", "created_at": iso_days_ago(14), "updated_at": iso_days_ago(5)},
    {"id": "int-forgeworks-01", "account_id": "forgeworks", "recommended_action": "alternative_workflow_review", "final_action": "alternative_workflow_review", "approver": "daniel", "status": "modified", "channel": "call", "reason": "Adjusted scope to a workflow workshop after CSM review.", "created_at": iso_days_ago(11), "updated_at": iso_days_ago(4)},
    {"id": "int-lumen-01", "account_id": "lumen", "recommended_action": "flexible_plan_review", "final_action": "flexible_plan_review", "approver": "mei", "status": "approved", "channel": "email", "reason": "Utilization at 24% and renewal survey cites price pressure.", "created_at": iso_days_ago(7), "updated_at": iso_days_ago(6)},
    {"id": "int-ember-01", "account_id": "ember", "recommended_action": "payment_retry_card_update", "final_action": "payment_retry_card_update", "approver": "daniel", "status": "executed", "channel": "email", "reason": "Card expired; two retry attempts failed.", "created_at": iso_days_ago(4), "updated_at": iso_days_ago(1)},
    {"id": "int-cobalt-01", "account_id": "cobalt", "recommended_action": "differentiation_review", "final_action": None, "approver": "aisha", "status": "rejected", "channel": "call", "reason": "Manager declined; insufficient competitor evidence at this time.", "created_at": iso_days_ago(6), "updated_at": iso_days_ago(5)},
    {"id": "int-meridian-01", "account_id": "meridian", "recommended_action": "pause_subscription", "final_action": "pause_subscription", "approver": "aisha", "status": "approved", "channel": "task", "reason": "Implementation project closed; documented return window in October.", "created_at": iso_days_ago(5), "updated_at": iso_days_ago(3)},
    {"id": "int-willow-01", "account_id": "willow", "recommended_action": "early_reengagement", "final_action": "early_reengagement", "approver": "mei", "status": "delivered", "channel": "in_app", "reason": "Seven licensed seats inactive; no complaint or cancellation signal.", "created_at": iso_days_ago(3), "updated_at": iso_days_ago(1)},
]

OUTCOMES = [
    {"intervention_id": "int-northstar-01", "renewed": True, "downgraded": False, "churned": False, "usage_delta": 18.0, "health_delta": 12.0, "response": "Incident resolved", "observation": "Observed over 14 days; no causal claim", "recorded_at": iso_days_ago(1)},
    {"intervention_id": "int-harborline-01", "renewed": None, "downgraded": False, "churned": False, "usage_delta": 9.0, "health_delta": 6.0, "response": "Training accepted", "observation": "Simulated 14-day observation", "recorded_at": iso_days_ago(2)},
    {"intervention_id": "int-forgeworks-01", "renewed": None, "downgraded": False, "churned": False, "usage_delta": 4.0, "health_delta": 3.0, "response": "Workflow workshop booked", "observation": "Simulated; product gap remains open", "recorded_at": iso_days_ago(3)},
    {"intervention_id": "int-lumen-01", "renewed": True, "downgraded": True, "churned": False, "usage_delta": 0.0, "health_delta": 4.0, "response": "Lower tier selected", "observation": "Simulated downgrade; revenue impact recorded", "recorded_at": iso_days_ago(4)},
    {"intervention_id": "int-ember-01", "renewed": True, "downgraded": False, "churned": False, "usage_delta": 0.0, "health_delta": 9.0, "response": "Card updated", "observation": "Simulated involuntary recovery", "recorded_at": iso_days_ago(1)},
    {"intervention_id": "int-cobalt-01", "renewed": None, "downgraded": None, "churned": None, "usage_delta": None, "health_delta": None, "response": "Rejected by manager", "observation": "No action taken; monitoring competitive signal", "recorded_at": iso_days_ago(5)},
    {"intervention_id": "int-meridian-01", "renewed": True, "downgraded": False, "churned": False, "usage_delta": None, "health_delta": 0.0, "response": "Pause accepted", "observation": "Simulated; resume date recorded", "recorded_at": iso_days_ago(2)},
    {"intervention_id": "int-willow-01", "renewed": True, "downgraded": False, "churned": False, "usage_delta": 3.0, "health_delta": 2.0, "response": "Check-in opened", "observation": "Observed response; no causal claim", "recorded_at": iso_days_ago(1)},
]


# ---------------------------------------------------------------------------
# Assembly, CSV output, wipe + insert
# ---------------------------------------------------------------------------
def build_all():
    rng = random.Random(SEED)
    generated_accounts, gen_bucket, gen_pos = generate_accounts(rng)
    accounts = NAMED_ACCOUNTS + generated_accounts

    all_users, all_subs, all_usage, all_payments, all_tickets, all_feedback = [], [], [], [], [], []
    for account in NAMED_ACCOUNTS:
        cfg = NAMED_CONFIG[account["id"]]
        u, s, ue, pe, tk, fb = build_bundle(account, cfg, rng)
        all_users += u; all_subs.append(s); all_usage += ue; all_payments += pe; all_tickets += tk; all_feedback += fb
    for account in generated_accounts:
        cfg = bucket_spec(gen_bucket[account["id"]], gen_pos[account["id"]], rng, account)
        u, s, ue, pe, tk, fb = build_bundle(account, cfg, rng)
        all_users += u; all_subs.append(s); all_usage += ue; all_payments += pe; all_tickets += tk; all_feedback += fb

    return accounts, all_users, all_subs, all_usage, all_payments, all_tickets, all_feedback


def to_csv_value(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    return v


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: to_csv_value(r.get(k)) for k in fieldnames})


def wipe(db) -> None:
    # outcomes has no `id` column — its primary key is intervention_id.
    for table in ["outcomes", "interventions", "action_recommendations", "cause_hypotheses",
                  "risk_predictions", "health_scores", "feedback_events", "support_tickets",
                  "payment_events", "usage_events", "subscriptions", "users", "accounts", "audit_logs"]:
        if table == "audit_logs":
            db.table(table).delete().neq("id", 0).execute()
        elif table == "outcomes":
            db.table(table).delete().neq("intervention_id", "__never__").execute()
        else:
            db.table(table).delete().neq("id", "__never__").execute()


def insert_batches(db, table: str, rows: list[dict], batch_size: int = 500) -> None:
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        if chunk:
            db.table(table).insert(chunk).execute()


def seed() -> None:
    accounts, users, subs, usage, payments, tickets, feedback = build_all()

    write_csv(DATA_DIR / "accounts.csv", accounts, ["id", "name", "initials", "owner_id", "plan", "segment", "industry", "arr_mrr", "start_date", "renewal_date"])
    write_csv(DATA_DIR / "users.csv", users, ["id", "account_id", "role", "seat_status"])
    write_csv(DATA_DIR / "subscriptions.csv", subs, ["id", "account_id", "plan", "price", "status", "renewal_date", "cancel_at"])
    write_csv(DATA_DIR / "usage_events.csv", usage, ["id", "account_id", "user_id", "feature", "timestamp", "count", "duration"])
    write_csv(DATA_DIR / "payment_events.csv", payments, ["id", "account_id", "timestamp", "status", "amount", "attempt", "failure_code"])
    write_csv(DATA_DIR / "support_tickets.csv", tickets, ["id", "account_id", "severity", "category", "opened_at", "closed_at", "sentiment", "resolution"])
    write_csv(DATA_DIR / "feedback_events.csv", feedback, ["id", "account_id", "metric_type", "score", "text", "timestamp"])
    write_csv(DATA_DIR / "interventions.csv", INTERVENTIONS, ["id", "account_id", "recommended_action", "final_action", "approver", "status", "channel", "reason", "created_at", "updated_at"])
    write_csv(DATA_DIR / "outcomes.csv", OUTCOMES, ["intervention_id", "renewed", "downgraded", "churned", "usage_delta", "health_delta", "response", "observation", "recorded_at"])

    db = get_supabase()
    wipe(db)

    insert_batches(db, "accounts", accounts)
    insert_batches(db, "users", users)
    insert_batches(db, "subscriptions", subs)
    insert_batches(db, "usage_events", usage)
    insert_batches(db, "payment_events", payments)
    insert_batches(db, "support_tickets", tickets)
    insert_batches(db, "feedback_events", feedback)
    insert_batches(db, "interventions", INTERVENTIONS)
    insert_batches(db, "outcomes", OUTCOMES)

    print(f"Seeded {len(accounts)} accounts, deterministic seed {SEED}")


if __name__ == "__main__":
    seed()
