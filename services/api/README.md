# ValueLoop API

Customer success backend: health scoring, risk prediction, cause hypotheses, action recommendations, intervention state machine, and audit trail.

## Quick Start

```bash
# Setup
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]

# Environment
cp .env.example .env
# Edit .env with your Supabase URL + service_role key

# Seed demo data (50 accounts, deterministic)
python scripts/seed_demo.py

# Run API
uvicorn app.main:app --reload --port 8000
```

## Testing

```bash
# Run all tests with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_interventions.py -v

# Coverage report
pytest --cov=app --cov-report=term-missing
```

Tests use real Supabase (no mocks). Session-scoped fixtures seed once per run and wipe computed tables between tests.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | `eyJ...` |
| `SUPABASE_ANON_KEY` | Anon key (for client-side) | `eyJ...` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `API_VERSION` | API version string | `v1` |

## API Endpoints

### Accounts & Profiles
- `GET /api/v1/accounts` — List all accounts
- `GET /api/v1/accounts/{id}` — Customer 360 profile
- `GET /api/v1/accounts/{id}/timeline` — Event timeline

### Analysis
- `POST /api/v1/accounts/{id}/analyze` — Full analysis (health + risks + causes + actions)
- `POST /api/v1/accounts/{id}/health` — Compute health scores
- `POST /api/v1/accounts/{id}/risks` — Predict risks
- `POST /api/v1/accounts/{id}/causes` — Generate cause hypotheses
- `POST /api/v1/accounts/{id}/actions` — Recommend actions

### Interventions
- `POST /api/v1/interventions` — Create intervention (pending)
- `PATCH /api/v1/interventions/{id}` — Transition state (approve/reject/execute)
- `POST /api/v1/interventions/{id}/outcome` — Record outcome (marks delivered)

### Dashboard & Audit
- `GET /api/v1/dashboard/kpis` — Dashboard KPIs (total accounts, at-risk MRR, etc.)
- `GET /api/v1/audit` — Query audit logs (filter by entity_type, entity_id, actor_id)

### Ingestion
- `POST /api/v1/ingestion/csv` — Upload CSV (validates, quarantines bad rows)
- `GET /api/v1/ingestion/jobs/{id}` — Check ingestion job status

## Architecture

```
app/
├── main.py              # FastAPI app factory
├── config.py            # Settings (env vars)
├── deps.py              # FastAPI dependencies
├── core/
│   ├── db.py            # Supabase client
│   ├── errors.py        # ApiError, NotFound, ValidationError
│   └── logging.py       # Structured logging
├── models/
│   ├── envelope.py      # Response envelope (data, meta, errors)
│   └── domain.py        # Pydantic models (Account, Intervention, etc.)
├── modules/
│   ├── health.py        # 5-dimension health scoring
│   ├── risk.py          # 5-output risk prediction
│   ├── causes.py        # Rule-based cause hypotheses
│   ├── actions.py       # Action recommendations
│   ├── policy.py        # Eligibility checker + safety gates
│   ├── interventions.py # Intervention state machine
│   ├── outcomes.py      # Outcome recording
│   └── ingestion.py     # CSV parsing + validation
└── api/v1/
    ├── router.py        # Route registration
    ├── accounts.py      # Account endpoints
    ├── timeline.py      # Timeline endpoint
    ├── analyze.py       # Combined analysis
    ├── health.py        # Health endpoint
    ├── risks.py         # Risks endpoint
    ├── causes.py        # Causes endpoint
    ├── actions.py       # Actions endpoint
    ├── interventions.py # Intervention endpoints
    ├── dashboard.py     # Dashboard KPIs
    ├── audit.py         # Audit query
    └── ingestion.py     # CSV ingestion
```

## Seed Data

`scripts/seed_demo.py` generates 50 accounts (9 named + 41 generated) with deterministic timestamps. Includes:
- Accounts, users, subscriptions
- Usage events, payment events, support tickets, feedback events
- Historical interventions + outcomes (8 rows)

Computed tables (health_scores, risk_predictions, cause_hypotheses, action_recommendations) are empty after seeding — computed on-demand via API calls.

**Reset seeds** (if CSVs get timestamp-churned):
```bash
git checkout -- data/seeds/
python scripts/seed_demo.py
```

## Database Schema

14 tables in Supabase (PostgreSQL):
- **Entity tables**: accounts, users, subscriptions, usage_events, payment_events, support_tickets, feedback_events
- **Computed tables**: health_scores, risk_predictions, cause_hypotheses, action_recommendations
- **Workflow tables**: interventions, outcomes, audit_logs

See `supabase/migrations/20260719183128_00001_initial_schema.sql` for full DDL.

RLS is OFF (internal tool, service-role key only).

## Known Gotchas

1. **maybe_single() bug**: `maybe_single().execute()` returns None directly on zero rows (not object with .data=None). Guard: `if not result or not result.data:`
2. **Pydantic v2 serialization**: Use `model_dump(mode="json")` (not `mode="python"`) for dicts passed to Supabase `.insert()` — datetime objects aren't JSON-serializable otherwise.
3. **Seed CSV churn**: `scripts/seed_demo.py` regenerates timestamps on each run. Always `git checkout -- data/seeds/` before commits.

## License

Internal project. No external license.
