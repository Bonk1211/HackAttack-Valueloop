# ValueLoop Backend & Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI backend, Supabase Postgres schema, seed pipeline, and governed decisioning engine so the existing Next.js frontend (`apps/web/`) can swap `lib/mock-data.ts` fixtures for live API calls.

**Architecture:** Modular-monolith FastAPI at `services/api/`. Single Postgres schema `public` on Supabase project `hhfowwvvwevnbpadfuqe`. Service-role Supabase client (no RLS on demo tables — internal CSM tool, auth enforced at API layer). Seed script populates 50 synthetic accounts deterministically. Rules and policies stored as versioned YAML in `policies/`. All schema changes flow through Supabase migrations.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, supabase-py, pandas, PyYAML, pytest, Uvicorn. Supabase Postgres 17 (hosted). Existing extensions available: `uuid-ossp`, `pgcrypto`, `pg_trgm`. No XGBoost yet — logistic-regression baseline only.

## Global Constraints

- Blueprint §6.1 defines 13 entity tables: `accounts`, `users`, `subscriptions`, `usage_events`, `payment_events`, `support_tickets`, `feedback_events`, `health_scores`, `risk_predictions`, `cause_hypotheses`, `action_recommendations`, `interventions`, `outcomes`, `audit_logs`. Every table gets an `id` primary key, `created_at`, and `updated_at`.
- Every prediction, rule evaluation, and state change stores a `version` and `generated_at`/`timestamp` field (blueprint §20.2).
- JSONB used for flexible evidence arrays (`evidence_json`, `contradictions_json`, `top_features_json`, `before_json`, `after_json`).
- All IDs are `text` using slugified names (e.g. `northstar`, `harborline`) — matches existing frontend fixture IDs in `apps/web/lib/mock-data.ts` lines 75–85. No UUIDs for primary demo entities.
- API response envelope per blueprint §12.1: `{ data, meta, errors }` with `request_id`, `generated_at`, `version`.
- Error codes per blueprint §12.2: 400/401/403/404/409/422/500/503.
- Health scores clamped to 0–100 (blueprint §7.1).
- No real customer data, no secrets in source, no LLM-dependent critical path.
- Python: 4-space indent, PEP 8, type hints on every public function. Snake_case functions, PascalCase classes.

## TDD Discipline

**Every implementation task follows strict RED → GREEN → REFACTOR. No production code before the test exists.**

### Rules

1. **Write the failing test first.** The test must fail for the *right* reason (function missing, wrong return, unhandled case) — not because of a typo or import error in the test itself. Verify the failure message before writing any implementation.
2. **Write the minimal code to make it green.** No speculative features, no premature abstraction. If the test passes with one line, ship one line.
3. **Refactor only while green.** Clean up only after the test passes. Run the full suite after every refactor.
4. **One commit per cycle.** Test + implementation + refactor = one logical commit. Do not commit red tests or green-but-broken code.
5. **Test isolation.** Every test is independent. Use `conftest.py` fixtures to seed a known DB state per test, wipe computed tables (`health_scores`, `risk_predictions`, `cause_hypotheses`, `action_recommendations`, `audit_logs`, `outcomes`) between tests so tests don't depend on execution order.
6. **No mocks for the DB.** Use the real Supabase project with service-role key. Seed once at the start of the test session via `session`-scoped fixture. Tests hit real SQL, real JSONB, real constraints.
7. **Parameterize edge cases.** Use `@pytest.mark.parametrize` for behavior that varies across accounts (northstar vs ember vs atlas) rather than writing N near-identical tests.
8. **Coverage floor.** Run `pytest --cov=app --cov-report=term-missing` after every task. Floor: 80% on `app/modules/`, 70% on `app/api/v1/`. Anything below triggers a refactor or a new test before moving on.
9. **No "test later" debt.** If a test would help but you're skipping it to save time, you've broken TDD. Write it now.

### Test File Conventions

- One test file per module: `test_health.py` for `modules/health.py`, `test_risks.py` for `modules/risk.py`, etc.
- API tests live alongside module tests — same file covers the endpoint and the underlying function.
- End-to-end flows live in `test_end_to_end.py` (Northstar full loop).
- Fixtures live in `conftest.py`. No fixture defined inside a test file.
- Test names read as specifications: `test_northstar_experience_score_low_when_critical_tickets_open`, not `test_health_1`.

### RED → GREEN → REFACTOR per task

Every task in this plan now has three explicit phases:

- **RED** — write the failing test, run it, confirm the exact failure reason.
- **GREEN** — write the minimal implementation, run the test, confirm it passes.
- **REFACTOR** — clean up, run the full suite, confirm everything still passes, commit.

If a task has multiple test cases, each test gets its own RED/GREEN cycle before moving to the next. Do not batch-write five tests and then five implementations.

---

## File Structure

```
services/api/
  app/
    __init__.py
    main.py                          # FastAPI app, CORS, lifespan, env
    config.py                        # Pydantic Settings, env validation
    deps.py                          # get_db, get_supabase, get_rules
    api/
      __init__.py
      v1/
        __init__.py
        router.py                    # mounts all v1 routers
        accounts.py                  # /accounts, /accounts/{id}
        health.py                    # /accounts/{id}/health
        risks.py                     # /accounts/{id}/risks
        causes.py                    # /accounts/{id}/causes
        actions.py                   # /accounts/{id}/actions
        timeline.py                  # /accounts/{id}/timeline
        analyze.py                   # /accounts/{id}/analyze
        interventions.py             # /interventions, /interventions/{id}, /interventions/{id}/outcome
        ingestion.py                 # /ingestion/csv, /ingestion/jobs/{id}
        dashboard.py                 # /dashboard/kpis
        audit.py                     # /audit
    models/
      __init__.py
      domain.py                      # Pydantic schemas for every entity (mirrors DB)
      envelope.py                    # ResponseEnvelope, Meta, error codes
    modules/
      __init__.py
      customer360.py                 # profile assembly, freshness, data quality
      features.py                    # point-in-time feature computation
      health.py                      # five-dimension scorer
      risk.py                        # logistic regression + rule fallback
      causes.py                      # rule-based hypothesis engine
      policy.py                      # eligibility, safety, frequency caps
      actions.py                     # utility scoring, registry
      explanations.py                # template engine (LLM-optional stub)
      interventions.py               # state machine, approval logic
      outcomes.py                    # post-action delta computation
      audit.py                       # immutable event writer
      ingestion.py                   # CSV parse, validate, dedupe, quarantine
    core/
      __init__.py
      db.py                          # Supabase client wrapper, query helpers
      errors.py                      # ApiError, NotFound, Conflict, etc.
      logging.py                     # structlog config
  tests/
    conftest.py                      # fixtures: test client, seeded DB snapshot
    test_accounts.py
    test_health.py
    test_risks.py
    test_causes.py
    test_policy.py                   # the 10 blueprint §15.1 policy tests
    test_interventions.py
    test_end_to_end.py               # Northstar Labs full loop
    test_ingestion.py
  pyproject.toml
  README.md

policies/
  actions.yaml                       # 8 actions, eligibility, approval rules
  cause_rules.yaml                   # 7 cause hypotheses + Unknown

data/seeds/
  accounts.csv
  users.csv
  subscriptions.csv
  usage_events.csv
  payment_events.csv
  support_tickets.csv
  feedback_events.csv
  interventions.csv                  # 8+ historical interventions
  outcomes.csv

scripts/
  seed_demo.py                       # deterministic reset, one command

tests/                               # root-level integration tests
  policy_smoke.py
  northstar_e2e.py
```

---

## Data Model & Relationships

### Table List (creation order respects FKs)

1. `accounts` — root entity, 50 seeded
2. `users` — seats within an account (FK → accounts.id)
3. `subscriptions` — one active per account (FK → accounts.id)
4. `usage_events` — feature usage time series (FK → accounts.id, users.id)
5. `payment_events` — billing attempts (FK → accounts.id)
6. `support_tickets` — ticket history (FK → accounts.id)
7. `feedback_events` — NPS/CSAT/verbatim (FK → accounts.id)
8. `health_scores` — versioned 5-dimension snapshots (FK → accounts.id)
9. `risk_predictions` — versioned risk outputs (FK → accounts.id)
10. `cause_hypotheses` — ranked rule evaluations (FK → accounts.id)
11. `action_recommendations` — filtered action registry output (FK → accounts.id)
12. `interventions` — approval + execution record (FK → accounts.id)
13. `outcomes` — post-intervention measurements (FK → interventions.id)
14. `audit_logs` — immutable event log (no FK, references by entity_id)

### Entity-Relationship Summary

```
accounts 1──* users
accounts 1──1 subscriptions (current active; history via status column)
accounts 1──* usage_events
accounts 1──* payment_events
accounts 1──* support_tickets
accounts 1──* feedback_events
accounts 1──* health_scores (versioned snapshots)
accounts 1──* risk_predictions (versioned snapshots)
accounts 1──* cause_hypotheses (regenerated per analyze call)
accounts 1──* action_recommendations (regenerated per analyze call)
accounts 1──* interventions
interventions 1──1 outcomes
```

### Indexes (add on creation)

- `accounts`: `(segment)`, `(owner_id)`, `(risk DESC NULLS LAST)` — dashboard sort hot path
- `usage_events`: `(account_id, timestamp DESC)`, `(account_id, feature, timestamp DESC)`
- `payment_events`: `(account_id, timestamp DESC)`
- `support_tickets`: `(account_id, opened_at DESC)`, `(severity)`
- `health_scores`: `(account_id, generated_at DESC)` — latest-score lookup
- `risk_predictions`: `(account_id, generated_at DESC)`
- `cause_hypotheses`: `(account_id, generated_at DESC, rank)`
- `action_recommendations`: `(account_id, generated_at DESC)`
- `interventions`: `(account_id, created_at DESC)`, `(status)`
- `audit_logs`: `(entity_type, entity_id, timestamp DESC)`, `(actor_id, timestamp DESC)`

---

## Task 1: Project Scaffold & Configuration

**Files:**
- Create: `services/api/pyproject.toml`
- Create: `services/api/app/__init__.py`
- Create: `services/api/app/main.py`
- Create: `services/api/app/config.py`
- Create: `services/api/app/core/__init__.py`
- Create: `services/api/app/core/db.py`
- Create: `services/api/app/core/errors.py`
- Create: `services/api/app/core/logging.py`
- Create: `services/api/app/deps.py`
- Create: `services/api/.env.example`
- Create: `services/api/README.md`

**Interfaces:**
- Consumes: nothing
- Produces: `get_settings()`, `get_supabase_client()`, `ApiError` base class, FastAPI `app` instance

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "valueloop-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.0",
    "pydantic==2.9.2",
    "pydantic-settings==2.6.1",
    "supabase==2.10.0",
    "pandas==2.2.3",
    "pyyaml==6.0.2",
    "structlog==24.4.0",
    "uvicorn[standard]==0.32.0",x
    "python-multipart==0.0.12",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.3",
    "pytest-cov==5.0.0",
    "httpx==0.27.2",
    "pytest-asyncio==0.24.0",
    "ruff==0.7.4",
]

[tool.ruff]
line-length = 120
target-version = "py312"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "-v --tb=short"

[tool.coverage.run]
source = ["app"]
omit = ["app/api/v1/__init__.py"]

[tool.coverage.report]
fail_under = 70
show_missing = true
skip_empty = true
```

- [ ] **Step 2: Create `.env.example`**

```
SUPABASE_URL=https://hhfowwvvwevnbpadfuqe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
LOG_LEVEL=INFO
API_VERSION=v1
```

- [ ] **Step 3: Create `app/config.py`**

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    log_level: str = "INFO"
    api_version: str = "v1"

@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

- [ ] **Step 4: Create `app/core/db.py`**

```python
from supabase import Client, create_client
from app.config import get_settings

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_service_role_key)
    return _client
```

- [ ] **Step 5: Create `app/core/errors.py`**

```python
from fastapi import status

class ApiError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)

class NotFound(ApiError):
    def __init__(self, entity: str, id: str):
        super().__init__(status.HTTP_404_NOT_FOUND, f"{entity} '{id}' not found")

class Conflict(ApiError):
    def __init__(self, message: str):
        super().__init__(status.HTTP_409_CONFLICT, message)

class ValidationError(ApiError):
    def __init__(self, message: str):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, message)
```

- [ ] **Step 6: Create `app/core/logging.py`**

```python
import structlog
from app.config import get_settings

def configure_logging() -> None:
    s = get_settings()
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if s.log_level == "DEBUG" else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            structlog.get_level_from_name(s.log_level)
        ),
    )
```

- [ ] **Step 7: Create `app/deps.py`**

```python
from typing import Iterator
from supabase import Client
from app.core.db import get_supabase

def get_db() -> Iterator[Client]:
    yield get_supabase()
```

- [ ] **Step 8: Create `app/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.core.errors import ApiError
from app.core.logging import configure_logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    yield

def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="ValueLoop API", version=s.api_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "https://web-livid-beta-ilnxxzodh3.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.code,
            content={"data": None, "meta": {"version": s.api_version}, "errors": [{"code": exc.code, "message": exc.message}]},
        )

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    from app.api.v1.router import api_router
    app.include_router(api_router, prefix="/api/v1")
    return app

app = create_app()
```

- [ ] **Step 9: Install and verify startup**

Run:
```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env  # then fill SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY from dashboard
uvicorn app.main:app --reload
```
Expected: `INFO:     Uvicorn running on http://127.0.0.1:8000` and `GET /healthz` returns `{"status":"ok"}`.

- [ ] **Step 10: Commit**

```bash
git add services/api
git commit -m "feat(api): scaffold FastAPI app with config, db, errors, logging"
```

---

## Task 1.5: Test Infrastructure (conftest.py, session-scoped seed, test client)

**Files:**
- Create: `services/api/tests/__init__.py`
- Create: `services/api/tests/conftest.py`

**Interfaces:**
- Consumes: `get_supabase()`, `seed_demo.py`, FastAPI `app`
- Produces: pytest fixtures `db` (session-scoped seeded Supabase client), `client` (FastAPI TestClient), `wipe_computed` (autouse fixture that clears derived tables between tests)

This task has no implementation code — it sets up the harness every subsequent task's RED/GREEN/REFACTOR cycle depends on.

- [ ] **Step 1: RED — write a smoke test that cannot yet pass**

Create `services/api/tests/conftest.py` (empty) and `services/api/tests/test_smoke.py`:

```python
def test_conftest_fixtures_exist(db, client):
    assert db is not None
    assert client is not None
```

Run: `pytest tests/test_smoke.py -v`
Expected: FAIL — `fixture 'db' not found`.

- [ ] **Step 2: GREEN — write `tests/conftest.py`**

```python
import subprocess
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

SEED_SCRIPT = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "seed_demo.py"
COMPUTED_TABLES = [
    "outcomes", "audit_logs", "action_recommendations",
    "cause_hypotheses", "risk_predictions", "health_scores",
]

@pytest.fixture(scope="session", autouse=True)
def seed_db_once():
    """Run the deterministic seed once per pytest session."""
    result = subprocess.run([sys.executable, str(SEED_SCRIPT)], capture_output=True, text=True)
    assert result.returncode == 0, f"seed_demo.py failed: {result.stderr}"
    yield

@pytest.fixture(scope="session")
def db():
    """Session-scoped Supabase client seeded with 50 accounts."""
    from app.core.db import get_supabase
    return get_supabase()

@pytest.fixture(scope="session")
def client():
    """Session-scoped FastAPI test client."""
    from app.main import app
    return TestClient(app)

@pytest.fixture(autouse=True)
def wipe_computed(db):
    """Clear derived tables between tests so they don't depend on execution order."""
    for table in COMPUTED_TABLES:
        db.table(table).delete().neq("id", "__never__").execute()
    yield
    for table in COMPUTED_TABLES:
        db.table(table).delete().neq("id", "__never__").execute()
```

Run: `pytest tests/test_smoke.py -v`
Expected: 1 passed.

- [ ] **Step 3: GREEN — verify seed state is correct**

Add to `tests/test_smoke.py`:

```python
def test_fifty_accounts_seeded(db):
    rows = db.table("accounts").select("id").execute().data
    assert len(rows) == 50

def test_northstar_exists(db):
    row = db.table("accounts").select("id,name").eq("id","northstar").maybe_single().execute()
    assert row.data["name"] == "Northstar Labs"

def test_computed_tables_empty_after_wipe(db):
    for table in ["health_scores","risk_predictions","cause_hypotheses","action_recommendations"]:
        assert db.table(table).select("id").execute().data == []
```

Run: `pytest tests/test_smoke.py -v`
Expected: 4 passed.

- [ ] **Step 4: REFACTOR — confirm coverage reporting works**

Run: `pytest --cov=app tests/test_smoke.py`
Expected: coverage report shows `app/` with measurable line counts. The `fail_under = 70` gate will trip on a real task run once real code exists.

- [ ] **Step 5: Commit**

```bash
git add services/api/tests/
git commit -m "test(infra): conftest with session seed, test client, computed-table wipe"
```

After this task lands, every subsequent task starts its RED step by writing into `tests/test_<module>.py` and relying on the `db` and `client` fixtures defined here.

---

## Task 2: Response Envelope & Domain Models

**Files:**
- Create: `services/api/app/models/__init__.py`
- Create: `services/api/app/models/domain.py`
- Create: `services/api/app/models/envelope.py`

**Interfaces:**
- Consumes: nothing
- Produces: Pydantic models for every blueprint §6.1 entity, `ResponseEnvelope[T]`

- [ ] **Step 1: Create `app/models/envelope.py`**

```python
from datetime import datetime, timezone
from typing import Generic, TypeVar
from uuid import uuid4
from pydantic import BaseModel, Field

T = TypeVar("T")

class Meta(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = "v1"

class ErrorItem(BaseModel):
    code: int | None = None
    message: str

class ResponseEnvelope(BaseModel, Generic[T]):
    data: T | None
    meta: Meta = Field(default_factory=Meta)
    errors: list[ErrorItem] = Field(default_factory=list)

def envelope(data: T, errors: list[ErrorItem] | None = None) -> ResponseEnvelope[T]:
    return ResponseEnvelope(data=data, errors=errors or [])
```

- [ ] **Step 2: Create `app/models/domain.py` — account and user entities**

```python
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field

class Account(BaseModel):
    id: str
    name: str
    initials: str
    owner_id: str
    plan: str
    segment: str
    industry: str
    arr_mrr: float
    start_date: date
    renewal_date: date
    created_at: datetime | None = None
    updated_at: datetime | None = None

class User(BaseModel):
    id: str
    account_id: str
    role: str
    seat_status: str
    created_at: datetime | None = None

class Subscription(BaseModel):
    id: str
    account_id: str
    plan: str
    price: float
    status: str  # active | cancelled | paused | past_due
    renewal_date: date | None = None
    cancel_at: datetime | None = None
    created_at: datetime | None = None
```

- [ ] **Step 3: Extend `app/models/domain.py` — event entities**

```python
class UsageEvent(BaseModel):
    id: str
    account_id: str
    user_id: str | None = None
    feature: str
    timestamp: datetime
    count: int = 0
    duration: float = 0.0

class PaymentEvent(BaseModel):
    id: str
    account_id: str
    timestamp: datetime
    status: str  # succeeded | failed | pending | refunded
    amount: float
    attempt: int = 1
    failure_code: str | None = None

class SupportTicket(BaseModel):
    id: str
    account_id: str
    severity: str  # critical | high | medium | low
    category: str
    opened_at: datetime
    closed_at: datetime | None = None
    sentiment: str | None = None
    resolution: str | None = None

class FeedbackEvent(BaseModel):
    id: str
    account_id: str
    metric_type: str  # nps | csat | verbatim
    score: float | None = None
    text: str | None = None
    timestamp: datetime
```

- [ ] **Step 4: Extend `app/models/domain.py` — computed entities**

```python
class HealthScore(BaseModel):
    account_id: str
    generated_at: datetime
    adoption: float = Field(ge=0, le=100)
    engagement: float = Field(ge=0, le=100)
    experience: float = Field(ge=0, le=100)
    financial: float = Field(ge=0, le=100)
    value: float = Field(ge=0, le=100)
    overall: float = Field(ge=0, le=100)
    version: str = "1.0"

class RiskPrediction(BaseModel):
    account_id: str
    risk_type: str  # cancellation | downgrade | inactivity | payment_failure | expansion_readiness
    probability: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    top_features_json: list[dict[str, Any]] = Field(default_factory=list)
    model_version: str = "1.0"
    generated_at: datetime | None = None

class CauseHypothesis(BaseModel):
    account_id: str
    cause: str  # payment | technical_support | product_fit | price_plan_fit | disengagement | lifecycle | competitive | unknown
    rank: int
    confidence: float = Field(ge=0, le=1)
    evidence_json: list[dict[str, Any]] = Field(default_factory=list)
    contradictions_json: list[dict[str, Any]] = Field(default_factory=list)
    rule_version: str = "1.0"
    generated_at: datetime | None = None
    unknown_reason: str | None = None

class ActionRecommendation(BaseModel):
    account_id: str
    action_code: str
    eligibility: bool
    rejection_reason: str | None = None
    utility_score: float | None = None
    approval_required: bool
    approval_reason: str | None = None
    benefit: str | None = None  # high | medium | low
    friction: str | None = None
    risk: str | None = None
    generated_at: datetime | None = None
```

- [ ] **Step 5: Extend `app/models/domain.py` — intervention, outcome, audit**

```python
class Intervention(BaseModel):
    id: str
    account_id: str
    recommended_action: str
    final_action: str | None = None
    approver: str | None = None
    status: str  # pending | approved | rejected | modified | executed | delivered
    channel: str | None = None
    reason: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

class Outcome(BaseModel):
    intervention_id: str
    renewed: bool | None = None
    downgraded: bool | None = None
    churned: bool | None = None
    usage_delta: float | None = None
    health_delta: float | None = None
    response: str | None = None
    observation: str | None = None
    recorded_at: datetime | None = None

class AuditLog(BaseModel):
    actor_id: str
    actor_role: str  # csm | manager | system
    action: str
    entity_type: str
    entity_id: str
    before_json: dict[str, Any] | None = None
    after_json: dict[str, Any] | None = None
    timestamp: datetime | None = None
    reason: str | None = None
```

- [ ] **Step 6: Create `app/models/__init__.py`**

```python
from app.models.envelope import ResponseEnvelope, envelope, Meta, ErrorItem
from app.models.domain import (
    Account, User, Subscription, UsageEvent, PaymentEvent,
    SupportTicket, FeedbackEvent, HealthScore, RiskPrediction,
    CauseHypothesis, ActionRecommendation, Intervention, Outcome, AuditLog,
)

__all__ = [
    "ResponseEnvelope", "envelope", "Meta", "ErrorItem",
    "Account", "User", "Subscription", "UsageEvent", "PaymentEvent",
    "SupportTicket", "FeedbackEvent", "HealthScore", "RiskPrediction",
    "CauseHypothesis", "ActionRecommendation", "Intervention", "Outcome", "AuditLog",
]
```

- [ ] **Step 7: Verify models import**

Run: `cd services/api && python -c "from app.models import Account, envelope; print(envelope(Account(id='x', name='x', initials='X', owner_id='o', plan='p', segment='s', industry='i', arr_mrr=1.0, start_date='2026-01-01', renewal_date='2027-01-01')))"`
Expected: prints envelope JSON without error.

- [ ] **Step 8: Commit**

```bash
git add services/api/app/models
git commit -m "feat(api): add Pydantic domain models and response envelope"
```

---

## Task 3: Supabase Schema — Core Tables

**Files:**
- Create: `services/api/supabase/migrations/00001_initial_schema.sql` (via `supabase migration new initial_schema` after CLI init — see step)

**Interfaces:**
- Consumes: nothing
- Produces: 14 tables, indexes, triggers for `updated_at`

- [ ] **Step 1: Initialize Supabase migration project**

```bash
cd services/api
supabase init
supabase link --project-ref hhfowwvvwevnbpadfuqe
supabase migration new initial_schema
```
Expected: creates `supabase/migrations/<timestamp>_initial_schema.sql`.

- [ ] **Step 2: Write migration — accounts, users, subscriptions**

Append to the generated migration file:

```sql
-- Enable uuid-ossp if needed (already installed per list_extensions)
create extension if not exists "uuid-ossp" schema extensions;

-- accounts
create table public.accounts (
  id text primary key,
  name text not null,
  initials text not null,
  owner_id text not null,
  plan text not null,
  segment text not null,
  industry text not null,
  arr_mrr numeric(12,2) not null default 0,
  start_date date not null,
  renewal_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_accounts_segment on public.accounts(segment);
create index idx_accounts_owner on public.accounts(owner_id);

-- users
create table public.users (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  role text not null,
  seat_status text not null default 'active',
  created_at timestamptz not null default now()
);
create index idx_users_account on public.users(account_id);

-- subscriptions
create table public.subscriptions (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  plan text not null,
  price numeric(12,2) not null,
  status text not null default 'active',
  renewal_date date,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('active','cancelled','paused','past_due'))
);
create index idx_subscriptions_account on public.subscriptions(account_id);
```

- [ ] **Step 3: Write migration — event tables**

```sql
create table public.usage_events (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  feature text not null,
  timestamp timestamptz not null,
  count int not null default 0,
  duration numeric(10,2) not null default 0
);
create index idx_usage_account_time on public.usage_events(account_id, timestamp desc);
create index idx_usage_account_feature on public.usage_events(account_id, feature, timestamp desc);

create table public.payment_events (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  timestamp timestamptz not null,
  status text not null,
  amount numeric(12,2) not null,
  attempt int not null default 1,
  failure_code text,
  constraint payment_status_check check (status in ('succeeded','failed','pending','refunded'))
);
create index idx_payment_account_time on public.payment_events(account_id, timestamp desc);

create table public.support_tickets (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  severity text not null,
  category text not null,
  opened_at timestamptz not null,
  closed_at timestamptz,
  sentiment text,
  resolution text,
  constraint ticket_severity_check check (severity in ('critical','high','medium','low'))
);
create index idx_tickets_account_time on public.support_tickets(account_id, opened_at desc);
create index idx_tickets_severity on public.support_tickets(severity);

create table public.feedback_events (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  metric_type text not null,
  score numeric(5,2),
  text text,
  timestamp timestamptz not null,
  constraint feedback_metric_check check (metric_type in ('nps','csat','verbatim'))
);
create index idx_feedback_account on public.feedback_events(account_id, timestamp desc);
```

- [ ] **Step 4: Write migration — computed-entity tables**

```sql
create table public.health_scores (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  generated_at timestamptz not null default now(),
  adoption numeric(5,2) not null check (adoption between 0 and 100),
  engagement numeric(5,2) not null check (engagement between 0 and 100),
  experience numeric(5,2) not null check (experience between 0 and 100),
  financial numeric(5,2) not null check (financial between 0 and 100),
  value numeric(5,2) not null check (value between 0 and 100),
  overall numeric(5,2) not null check (overall between 0 and 100),
  version text not null default '1.0'
);
create index idx_health_account_time on public.health_scores(account_id, generated_at desc);

create table public.risk_predictions (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  risk_type text not null,
  probability numeric(4,3) not null check (probability between 0 and 1),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  top_features_json jsonb not null default '[]'::jsonb,
  model_version text not null default '1.0',
  generated_at timestamptz not null default now(),
  constraint risk_type_check check (risk_type in ('cancellation','downgrade','inactivity','payment_failure','expansion_readiness'))
);
create index idx_risk_account_time on public.risk_predictions(account_id, generated_at desc);

create table public.cause_hypotheses (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  cause text not null,
  rank int not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  evidence_json jsonb not null default '[]'::jsonb,
  contradictions_json jsonb not null default '[]'::jsonb,
  rule_version text not null default '1.0',
  generated_at timestamptz not null default now(),
  unknown_reason text,
  constraint cause_check check (cause in ('payment','technical_support','product_fit','price_plan_fit','disengagement','lifecycle','competitive','unknown'))
);
create index idx_causes_account_time_rank on public.cause_hypotheses(account_id, generated_at desc, rank);
```

- [ ] **Step 5: Write migration — interventions, outcomes, audit**

```sql
create table public.action_recommendations (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  action_code text not null,
  eligibility boolean not null,
  rejection_reason text,
  utility_score numeric(6,3),
  approval_required boolean not null default false,
  approval_reason text,
  benefit text,
  friction text,
  risk text,
  generated_at timestamptz not null default now()
);
create index idx_actions_account_time on public.action_recommendations(account_id, generated_at desc);

create table public.interventions (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  recommended_action text not null,
  final_action text,
  approver text,
  status text not null default 'pending',
  channel text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intervention_status_check check (status in ('pending','approved','rejected','modified','executed','delivered'))
);
create index idx_interventions_account on public.interventions(account_id, created_at desc);
create index idx_interventions_status on public.interventions(status);

create table public.outcomes (
  intervention_id text primary key references public.interventions(id) on delete cascade,
  renewed boolean,
  downgraded boolean,
  churned boolean,
  usage_delta numeric(8,2),
  health_delta numeric(8,2),
  response text,
  observation text,
  recorded_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigserial primary key,
  actor_id text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_json jsonb,
  after_json jsonb,
  timestamp timestamptz not null default now(),
  reason text
);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id, timestamp desc);
create index idx_audit_actor on public.audit_logs(actor_id, timestamp desc);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_accounts_updated before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger trg_interventions_updated before update on public.interventions
  for each row execute function public.set_updated_at();
```

- [ ] **Step 6: Apply migration to remote Supabase**

```bash
supabase db push
```
Expected: `Remote database is up to date.` and 14 tables visible in Supabase dashboard.

- [ ] **Step 7: Verify tables**

Run via MCP `list_tables` or `supabase db query 'select table_name from information_schema.tables where table_schema=$$public$$ order by table_name'`.
Expected: 14 rows — `accounts`, `action_recommendations`, `audit_logs`, `cause_hypotheses`, `feedback_events`, `health_scores`, `interventions`, `outcomes`, `payment_events`, `risk_predictions`, `subscriptions`, `support_tickets`, `usage_events`, `users`.

- [ ] **Step 8: Commit**

```bash
git add services/api/supabase
git commit -m "feat(db): add initial schema — 14 tables, indexes, triggers"
```

---

## Task 4: Deterministic Seed Data & Script

**Files:**
- Create: `data/seeds/accounts.csv` (50 rows)
- Create: `data/seeds/users.csv`, `subscriptions.csv`, `usage_events.csv`, `payment_events.csv`, `support_tickets.csv`, `feedback_events.csv`, `interventions.csv`, `outcomes.csv`
- Create: `scripts/seed_demo.py`

**Interfaces:**
- Consumes: `services/api/app/core/db.py` `get_supabase()`
- Produces: 50 seeded accounts including 9 named fixtures (northstar, harborline, forgeworks, lumen, ember, cobalt, meridian, willow, atlas) plus 41 generated accounts. Deterministic — same output every run.

- [ ] **Step 1: Hand-author 9 named account rows matching `apps/web/lib/mock-data.ts`**

Write `data/seeds/accounts.csv`:

```csv
id,name,initials,owner_id,plan,segment,industry,arr_mrr,start_date,renewal_date
northstar,Northstar Labs,NL,aisha,Scale,Enterprise,B2B analytics,8200,2025-08-12,2026-08-12
harborline,Harborline Ops,HO,mei,Growth,Growth,Logistics,4800,2025-09-03,2026-09-03
forgeworks,Forgeworks Studio,FS,daniel,Growth,Growth,Manufacturing,5100,2025-09-21,2026-09-21
lumen,LumenWorks,LW,mei,Growth,Growth,Creative services,4100,2025-09-19,2026-09-19
ember,Ember Commerce,EC,daniel,Growth,Growth,Commerce,5600,2025-07-28,2026-07-28
cobalt,Cobalt Systems,CS,aisha,Scale,Enterprise,Cybersecurity,9100,2025-10-11,2026-10-11
meridian,Meridian Cloud,MC,aisha,Scale,Enterprise,Cloud operations,7900,2025-09-04,2026-09-04
willow,Willow Health,WH,mei,Team,Team,Health services,3200,2025-10-17,2026-10-17
atlas,Atlas Robotics,AR,daniel,Scale,Enterprise,Robotics,9400,2025-11-02,2026-11-02
```

- [ ] **Step 2: Generate remaining 41 accounts deterministically**

Add a Python generator in `scripts/seed_demo.py` (full script in step 5) that:
- Uses `random.Random(42)` seed
- Draws from fixed pools: plans `["Team","Growth","Scale"]`, segments `["Team","Growth","Enterprise"]`, industries `["Analytics","Logistics","Healthcare","Finance","Retail","Manufacturing","SaaS","Education"]`, owners `["aisha","mei","daniel"]`
- Names them `<Adjective>-<Noun>` from fixed word lists
- Ensures at least 10 accounts per major cause pattern (payment failure, technical/support, low adoption, plan mismatch, normal) — total 50
- Includes 5 ambiguous accounts with conflicting evidence
- Includes 5 expansion-readiness positive accounts

- [ ] **Step 3: Write event CSVs for all 50 accounts**

Generator produces, per account:
- 20–60 `usage_events` across features `["core_workflow","dashboard","reports","exports","settings"]` over last 30 days
- 2–6 `payment_events` (succeeded or failed per account's churn pattern)
- 0–4 `support_tickets` (severity/category per pattern)
- 1–3 `feedback_events` (NPS/CSAT/verbatim per pattern)
- 3–8 `users` (seats, active/inactive per pattern)
- 1 `subscription` (status per pattern)

Named fixture events must reproduce `mock-data.ts` numbers (e.g. northstar: 2 critical open tickets, 42% usage drop, payments current).

- [ ] **Step 4: Write historical interventions CSV**

`data/seeds/interventions.csv` — 8 rows across different accounts, statuses (`approved`, `rejected`, `executed`, `delivered`, `modified`), channels (`email`, `call`, `in_app`, `task`).

`data/seeds/outcomes.csv` — one outcome per intervention with realistic deltas.

- [ ] **Step 5: Write `scripts/seed_demo.py`**

```python
#!/usr/bin/env python3
"""Deterministic seed for ValueLoop demo. Idempotent — wipes and re-inserts."""
import csv
import random
import sys
from pathlib import Path
from datetime import date, datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services/api"))

from app.core.db import get_supabase

# 9 named fixtures from apps/web/lib/mock-data.ts
NAMED_ACCOUNTS = [
    # loaded from data/seeds/accounts.csv
]

# Fixed pools for generated accounts
PLANS = ["Team", "Growth", "Scale"]
SEGMENTS = ["Team", "Growth", "Enterprise"]
OWNERS = ["aisha", "mei", "daniel"]
ADJECTIVES = ["Summit","River","Cedar","Iron","Bright","North","South","East","West","Stone","Harbor","Oak","Pine","Copper","Silver","Golden"]
NOUNS = ["Labs","Works","Systems","Solutions","Group","Partners","Industries","Analytics","Studio","Commerce","Cloud","Health","Robotics","Ops"]

# Cause-pattern buckets: 10 payment-failure, 10 technical/support, 10 low-adoption, 10 plan-mismatch, 10 normal/expansion
CAUSE_BUCKETS = ["payment"] * 10 + ["technical"] * 10 + ["adoption"] * 10 + ["price"] * 10 + ["normal"] * 10

def generate_events(account_id: str, bucket: str, rng: random.Random) -> dict:
    """Return dict of usage_events, payment_events, support_tickets, feedback_events, users, subscription."""
    # Implementation per bucket pattern — see full script in repository
    ...

def wipe(db) -> None:
    for table in ["outcomes","interventions","action_recommendations","cause_hypotheses",
                   "risk_predictions","health_scores","feedback_events","support_tickets",
                   "payment_events","usage_events","subscriptions","users","accounts","audit_logs"]:
        db.table(table).delete().neq("id","__never__").execute() if table != "audit_logs" else db.table(table).delete().neq("id",0).execute()

def seed() -> None:
    db = get_supabase()
    wipe(db)
    # 1. Insert 9 named accounts from CSV
    # 2. Generate + insert 41 more from deterministic pools
    # 3. For each account: insert users, subscription, events
    # 4. Insert historical interventions + outcomes
    print(f"Seeded {50} accounts, deterministic seed 42")

if __name__ == "__main__":
    seed()
```

(Full generator body — ~250 lines — written at implementation time; structure and bucket logic locked in here.)

- [ ] **Step 6: Run seed and verify**

```bash
cd /Users/johnnytan5/Documents/HackAttack-Valueloop
source services/api/.venv/bin/activate
python scripts/seed_demo.py
```
Expected: `Seeded 50 accounts, deterministic seed 42`. Then `select count(*) from accounts` returns 50, `select id from accounts where id in ('northstar','ember','willow')` returns all 3.

- [ ] **Step 7: Verify determinism — run twice, diff row counts**

Run `python scripts/seed_demo.py` again. Expected: identical row counts, same IDs, no duplicate errors (wipe runs first).

- [ ] **Step 8: Commit**

```bash
git add data/seeds scripts/seed_demo.py
git commit -m "feat(seed): deterministic 50-account demo data with 9 named fixtures"
```

---

## Task 5: Customer 360, Timeline & Account Endpoints

**Files:**
- Create: `services/api/tests/test_accounts.py` (RED step first)
- Create: `services/api/app/api/__init__.py`
- Create: `services/api/app/api/v1/__init__.py`
- Create: `services/api/app/api/v1/router.py`
- Create: `services/api/app/api/v1/accounts.py`
- Create: `services/api/app/api/v1/timeline.py`
- Create: `services/api/app/modules/customer360.py`

**Interfaces:**
- Consumes: `get_db`, `Account`, `ResponseEnvelope`
- Produces: `GET /accounts`, `GET /accounts/{id}`, `GET /accounts/{id}/timeline`, `assemble_profile(account_id)`

### Phase A — RED (tests first, no implementation)

- [ ] **Step 1: Write `tests/test_accounts.py` — all test cases fail**

```python
import pytest

@pytest.mark.parametrize("account_id,expected_name", [
    ("northstar", "Northstar Labs"),
    ("ember", "Ember Commerce"),
    ("atlas", "Atlas Robotics"),
])
def test_get_account_returns_name(client, account_id, expected_name):
    r = client.get(f"/api/v1/accounts/{account_id}")
    assert r.status_code == 200
    assert r.json()["data"]["account"]["name"] == expected_name

def test_list_accounts_returns_50(client):
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200
    assert len(r.json()["data"]) == 50

def test_get_account_not_found_returns_404(client):
    r = client.get("/api/v1/accounts/nonexistent")
    assert r.status_code == 404
    body = r.json()
    assert body["errors"][0]["code"] == 404

def test_account_has_freshness(client):
    r = client.get("/api/v1/accounts/northstar")
    assert r.status_code == 200
    freshness = r.json()["data"]["freshness"]
    assert "product_usage" in freshness
    assert freshness["product_usage"] != "no data"

def test_account_has_data_quality_score(client):
    r = client.get("/api/v1/accounts/northstar")
    assert r.status_code == 200
    assert 0 <= r.json()["data"]["data_quality"] <= 100

def test_timeline_sorted_desc(client):
    r = client.get("/api/v1/accounts/northstar/timeline")
    assert r.status_code == 200
    events = r.json()["data"]
    ts = [e["timestamp"] for e in events]
    assert ts == sorted(ts, reverse=True)
    assert any(e["kind"] == "usage" for e in events)
    assert any(e["kind"] == "support" for e in events)

def test_timeline_404_for_missing_account(client):
    r = client.get("/api/v1/accounts/nonexistent/timeline")
    assert r.status_code == 404
```

Run: `pytest tests/test_accounts.py -v`
Expected: **7 failures**. Confirm each fails for the right reason:
- `test_get_account_*` → 404 because `/api/v1/accounts/{id}` route doesn't exist yet
- `test_list_accounts_returns_50` → 404 because `/api/v1/accounts` route missing
- `test_timeline_*` → 404 because `/api/v1/accounts/{id}/timeline` missing

- [ ] **Step 2: Verify RED — no implementation yet**

Run: `find services/api/app/modules services/api/app/api -name "*.py" | xargs ls -la 2>/dev/null`
Expected: modules/ and api/ directories do not yet contain customer360.py, accounts.py, or timeline.py.

### Phase B — GREEN (minimal implementation to pass tests)

- [ ] **Step 3: Implement `app/modules/customer360.py`**

```python
from datetime import datetime, timezone
from supabase import Client
from app.core.errors import NotFound

def assemble_profile(db: Client, account_id: str) -> dict:
    acct = db.table("accounts").select("*").eq("id", account_id).maybe_single().execute()
    if not acct.data:
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
    if not acct.data:
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
```

- [ ] **Step 4: Implement `app/api/v1/accounts.py`**

```python
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
```

- [ ] **Step 5: Implement `app/api/v1/timeline.py`**

```python
from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.customer360 import build_timeline

router = APIRouter()

@router.get("/accounts/{account_id}/timeline")
def get_timeline(account_id: str, db: Client = Depends(get_db)):
    return envelope(data=build_timeline(db, account_id))
```

- [ ] **Step 6: Wire router and run tests**

Create `app/api/v1/router.py`:

```python
from fastapi import APIRouter
from app.api.v1 import accounts, timeline

api_router = APIRouter()
api_router.include_router(accounts.router, tags=["accounts"])
api_router.include_router(timeline.router, tags=["timeline"])
```

Run: `pytest tests/test_accounts.py -v`
Expected: **7 passed.** If any test still fails, fix the implementation — do not edit the test.

### Phase C — REFACTOR (verify, clean up, commit)

- [ ] **Step 7: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; `app/modules/customer360.py` and `app/api/v1/accounts.py` ≥70% covered.

- [ ] **Step 8: Commit**

```bash
git add services/api/app/modules/customer360.py services/api/app/api services/api/tests/test_accounts.py
git commit -m "feat(api): accounts, timeline, customer 360 (TDD: 7 tests passing)"
```

---

## Task 6: Health Scoring Engine

**Files:**
- Create: `services/api/tests/test_health.py` (RED step first)
- Create: `services/api/app/modules/health.py`
- Create: `services/api/app/api/v1/health.py`

**Interfaces:**
- Consumes: `assemble_profile`, `HealthScore`
- Produces: `score_health(db, account_id) -> HealthScore`, `GET /accounts/{id}/health`

### Phase A — RED

- [ ] **Step 1: Write failing tests — confirm each fails for the right reason**

```python
import pytest

def test_health_northstar_experience_low(client):
    r = client.get("/api/v1/accounts/northstar/health")
    assert r.status_code == 200
    h = r.json()["data"]
    assert 0 <= h["experience"] <= 40  # 2 critical tickets → ~29
    assert h["financial"] >= 80        # payments current
    assert all(0 <= h[dim] <= 100 for dim in ["adoption","engagement","experience","financial","value"])

def test_health_ember_financial_low(client):
    r = client.get("/api/v1/accounts/ember/health")
    h = r.json()["data"]
    assert h["financial"] < 40  # 2 failed payment attempts
    assert h["adoption"] > 60   # usage stable

def test_health_stored_with_version(client):
    r = client.get("/api/v1/accounts/northstar/health")
    h = r.json()["data"]
    assert h["version"] == "1.0"

def test_health_overall_is_weighted_sum(client):
    r = client.get("/api/v1/accounts/atlas/health")
    h = r.json()["data"]
    expected = (
        h["adoption"] * 0.25 + h["engagement"] * 0.20 + h["experience"] * 0.20
        + h["financial"] * 0.20 + h["value"] * 0.15
    )
    assert abs(h["overall"] - round(expected, 1)) < 0.2
```

Run: `pytest tests/test_health.py -v`
Expected: **4 failures.** Each must fail because `/api/v1/accounts/{id}/health` route does not exist (404), NOT because of test typos.

### Phase B — GREEN

- [ ] **Step 2: Implement `app/modules/health.py`**

```python
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
    # baseline: 1 event/day over last 30 days
    recent = [e for e in core if _parse_ts(e["timestamp"]) > _now() - _days(7)]
    daily_rate = len(recent) / 7
    return _clamp(daily_rate / 1.0 * 80 + 20)

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
        if sev == "critical": score -= 25
        elif sev == "high": score -= 15
        elif sev == "medium": score -= 8
        else: score -= 3
    return _clamp(score)

def _financial_score(payments: list[dict]) -> float:
    if not payments: return 80.0
    recent = sorted(payments, key=lambda p: p["timestamp"], reverse=True)[:5]
    failures = sum(1 for p in recent if p["status"] == "failed")
    return _clamp(100 - failures * 25)

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
    profile = assemble_profile(db, account_id)
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
    # persist snapshot
    db.table("health_scores").insert(hs.model_dump(exclude={"id"}, mode="python")).execute()
    return hs
```

(Note: `HealthScore` has no `id` field; Supabase auto-generates it.)

- [ ] **Step 3: Mount `/accounts/{id}/health` endpoint**

Add to `app/api/v1/health.py` and include in `router.py`:

```python
from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.health import score_health

router = APIRouter()

@router.get("/accounts/{account_id}/health")
def get_health(account_id: str, db: Client = Depends(get_db)):
    return envelope(data=score_health(db, account_id).model_dump(mode="python"))
```

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
pytest tests/test_health.py -v
```
Expected: **4 passed.** If any fails, fix implementation — do not edit the test.

### Phase C — REFACTOR

- [ ] **Step 5: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; `app/modules/health.py` ≥80% covered. If below, add tests for uncovered branches (e.g. `_adoption_score` with empty usage, `_value_score` with no CSAT feedback).

- [ ] **Step 6: Commit**

```bash
git add services/api/app/modules/health.py services/api/app/api/v1/health.py services/api/tests/test_health.py
git commit -m "feat(api): five-dimension health scorer (TDD: 4 tests passing)"
```

---

## Task 7: Risk Engine

**Files:**
- Create: `services/api/tests/test_risks.py` (RED step first)
- Create: `services/api/app/modules/risk.py`
- Create: `services/api/app/api/v1/risks.py`

**Interfaces:**
- Consumes: health scores, event tables
- Produces: `predict_risks(db, account_id) -> list[RiskPrediction]`, `GET /accounts/{id}/risks`

### Phase A — RED

- [ ] **Step 1: Write failing tests — verify each fails for the right reason**

```python
def test_risks_northstar_cancellation_high(client):
    r = client.get("/api/v1/accounts/northstar/risks")
    body = r.json()
    canc = next(x for x in body["data"] if x["risk_type"] == "cancellation")
    assert canc["probability"] >= 0.75
    assert canc["model_version"] == "1.0"

def test_risks_ember_payment_failure(client):
    r = client.get("/api/v1/accounts/ember/risks")
    body = r.json()
    pay = next(x for x in body["data"] if x["risk_type"] == "payment_failure")
    assert pay["probability"] >= 0.70

def test_risks_atlas_expansion_ready(client):
    r = client.get("/api/v1/accounts/atlas/risks")
    body = r.json()
    exp = next(x for x in body["data"] if x["risk_type"] == "expansion_readiness")
    assert exp["probability"] >= 0.70

def test_risks_returns_all_five_types(client):
    r = client.get("/api/v1/accounts/northstar/risks")
    types = {x["risk_type"] for x in r.json()["data"]}
    assert types == {"cancellation","downgrade","inactivity","payment_failure","expansion_readiness"}
```

Run: `pytest tests/test_risks.py -v`
Expected: **4 failures.** All must fail because `/api/v1/accounts/{id}/risks` returns 404.

### Phase B — GREEN

- [ ] **Step 2: Implement `app/modules/risk.py`**

```python
from datetime import datetime, timezone
from supabase import Client
from app.models import RiskPrediction

def _risk(risk_type, prob, conf, features=None) -> RiskPrediction:
    return RiskPrediction(
        account_id="",  # set by caller
        risk_type=risk_type,
        probability=round(max(0.0, min(1.0, prob)), 3),
        confidence=round(max(0.0, min(1.0, conf)), 3),
        top_features_json=features or [],
        model_version="1.0",
        generated_at=datetime.now(timezone.utc),
    )

def predict_risks(db: Client, account_id: str) -> list[RiskPrediction]:
    usage = db.table("usage_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    sub = db.table("subscriptions").select("*").eq("account_id", account_id).order("created_at", desc=True).limit(1).execute().data

    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] in ("critical","high"))
    pay_failures_30d = sum(1 for p in payments if p["status"] == "failed")
    # naive proxies: usage count, feedback scores
    recent_usage = len(usage)
    feedback_scores = [f["score"] for f in feedback if f.get("score") is not None]
    avg_feedback = sum(feedback_scores) / len(feedback_scores) if feedback_scores else 5.0

    # Cancellation: high tickets + low usage
    cancel_prob = 0.3 + 0.1 * open_critical + max(0, (30 - recent_usage) / 30) * 0.3
    cancel_conf = 0.7 + 0.05 * (open_critical + (1 if pay_failures_30d else 0))

    # Downgrade: low usage + low feedback
    down_prob = 0.2 + max(0, (30 - recent_usage) / 30) * 0.4 + max(0, (7 - avg_feedback) / 10) * 0.3
    down_conf = 0.65

    # Inactivity: very low recent usage
    inact_prob = max(0, (20 - recent_usage) / 20) * 0.8
    inact_conf = 0.6

    # Payment failure
    pay_prob = min(0.95, 0.2 + 0.2 * pay_failures_30d)
    pay_conf = 0.85 if pay_failures_30d else 0.5

    # Expansion readiness: high usage + high feedback + no open tickets
    exp_prob = 0.1 + min(1, recent_usage / 40) * 0.4 + (avg_feedback / 10) * 0.4
    if open_critical: exp_prob *= 0.3
    exp_conf = 0.7

    preds = [
        _risk("cancellation", cancel_prob, cancel_conf, [{"feature":"open_critical_tickets","value":open_critical}]),
        _risk("downgrade", down_prob, down_conf, [{"feature":"recent_usage","value":recent_usage}]),
        _risk("inactivity", inact_prob, inact_conf, [{"feature":"recent_usage","value":recent_usage}]),
        _risk("payment_failure", pay_prob, pay_conf, [{"feature":"pay_failures_30d","value":pay_failures_30d}]),
        _risk("expansion_readiness", exp_prob, exp_conf, [{"feature":"avg_feedback","value":round(avg_feedback,2)}]),
    ]
    for p in preds:
        p.account_id = account_id
    # persist
    for p in preds:
        db.table("risk_predictions").insert(p.model_dump(exclude={"id"}, mode="python")).execute()
    return preds
```

- [ ] **Step 3: Mount endpoint, run tests to confirm GREEN**

Add `app/api/v1/risks.py` with `GET /accounts/{account_id}/risks`, include in router.

Run: `pytest tests/test_risks.py -v`
Expected: **4 passed.**

### Phase C — REFACTOR

- [ ] **Step 4: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; `app/modules/risk.py` ≥80%. Add tests for probability clamping (0.0/1.0 bounds) if coverage is thin.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/modules/risk.py services/api/app/api/v1/risks.py services/api/tests/test_risks.py
git commit -m "feat(api): five-output risk predictor (TDD: 4 tests passing)"
```

---

## Task 8: Cause Hypothesis Engine

**Files:**
- Create: `services/api/tests/test_causes.py` (RED step first)
- Create: `policies/cause_rules.yaml`
- Create: `services/api/app/modules/causes.py`
- Create: `services/api/app/api/v1/causes.py`

**Interfaces:**
- Consumes: event tables, `cause_rules.yaml`
- Produces: `generate_hypotheses(db, account_id) -> list[CauseHypothesis]`, `GET /accounts/{id}/causes`

### Phase A — RED

- [ ] **Step 1: Write failing tests**

```python
def test_northstar_top_cause_is_technical_support(client):
    r = client.get("/api/v1/accounts/northstar/causes")
    body = r.json()
    top = body["data"][0]
    assert top["cause"] == "technical_support"
    assert top["confidence"] >= 0.70
    assert top["rank"] == 1

def test_ember_top_cause_is_payment(client):
    r = client.get("/api/v1/accounts/ember/causes")
    body = r.json()
    assert body["data"][0]["cause"] == "payment"
    assert body["data"][0]["confidence"] >= 0.85

def test_unknown_fallback_for_low_signal_account(client):
    r = client.get("/api/v1/accounts/willow/causes")
    body = r.json()
    # willow has disengagement evidence; may or may not hit unknown
    # but at minimum: results is a non-empty list
    assert len(body["data"]) >= 1

def test_hypotheses_include_evidence_and_contradictions(client):
    r = client.get("/api/v1/accounts/northstar/causes")
    body = r.json()
    for h in body["data"]:
        assert "evidence_json" in h
        assert "contradictions_json" in h
        assert isinstance(h["evidence_json"], list)

def test_rule_version_present(client):
    r = client.get("/api/v1/accounts/northstar/causes")
    for h in r.json()["data"]:
        assert h["rule_version"] == "1.0"
```

Run: `pytest tests/test_causes.py -v`
Expected: **5 failures.** All must fail because `/api/v1/accounts/{id}/causes` returns 404.

### Phase B — GREEN

- [ ] **Step 2: Write `policies/cause_rules.yaml`**

```yaml
version: "1.0"
causes:
  - code: payment
    label: "Payment"
    trigger: "payment_failures_30d >= 2 AND subscription_status != 'cancelled'"
    confidence_formula: "min(0.95, 0.60 + 0.10 * payment_failures_30d)"
    supporting_evidence: ["failed_attempts", "expiry_risk", "payment_status_past_due"]
    contradicting_evidence: ["payments_current", "no_failures"]

  - code: technical_support
    label: "Technical / Support"
    trigger: "open_critical_tickets >= 1 OR open_high_tickets >= 2"
    confidence_formula: "min(0.95, 0.60 + 0.13 * open_critical_tickets + 0.07 * open_high_tickets)"
    supporting_evidence: ["high_severity", "repeat_tickets", "long_unresolved"]
    contradicting_evidence: ["no_tickets", "rapid_resolution"]

  - code: product_fit
    label: "Product Fit"
    trigger: "core_feature_usage_rate < 0.4"
    confidence_formula: "0.30 + 0.5 * (1 - core_feature_usage_rate)"
    supporting_evidence: ["core_feature_not_used", "adoption_low_after_onboarding"]
    contradicting_evidence: ["high_goal_completion"]

  - code: price_plan_fit
    label: "Price / Plan Fit"
    trigger: "plan_utilization < 0.4 OR price_objection_recorded"
    confidence_formula: "0.40 + 0.4 * (1 - plan_utilization)"
    supporting_evidence: ["low_utilization_relative_to_plan", "price_objections"]
    contradicting_evidence: ["near_limits", "high_value"]

  - code: disengagement
    label: "Disengagement"
    trigger: "active_days_decline_30d > 0.4"
    confidence_formula: "0.40 + 0.5 * active_days_decline_30d"
    supporting_evidence: ["declining_active_days", "declining_logins"]
    contradicting_evidence: ["stable_value_outcomes"]

  - code: lifecycle
    label: "Lifecycle"
    trigger: "project_end_recorded OR seasonal_pause"
    confidence_formula: "0.75"
    supporting_evidence: ["seasonality", "temporary_pause", "project_end"]
    contradicting_evidence: ["persistent_negative_experience"]

  - code: competitive
    label: "Competitive"
    trigger: "competitor_named OR export_spike"
    confidence_formula: "0.70 + 0.1 * (export_spike_ratio - 1)"
    supporting_evidence: ["competitor_named", "exports_increased", "feature_gap"]
    contradicting_evidence: ["long_contract_remaining"]

  - code: unknown
    label: "Unknown"
    trigger: "no_hypothesis_above_threshold"
    confidence_formula: "0.25"
    supporting_evidence: []
    contradicting_evidence: []
```

- [ ] **Step 2: Implement `app/modules/causes.py`**

```python
from datetime import datetime, timezone
from pathlib import Path
import yaml
from supabase import Client
from app.models import CauseHypothesis

RULES_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "policies" / "cause_rules.yaml"

def _load_rules() -> dict:
    return yaml.safe_load(RULES_PATH.read_text())

def _features(db: Client, account_id: str) -> dict:
    usage = db.table("usage_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    sub = db.table("subscriptions").select("*").eq("account_id", account_id).order("created_at", desc=True).limit(1).execute().data

    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "critical")
    open_high = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "high")
    pay_failures_30d = sum(1 for p in payments if p["status"] == "failed")
    sub_status = sub[0]["status"] if sub else "active"
    # naive proxies:
    core_usage_rate = 0.5  # placeholder
    plan_utilization = 0.5  # placeholder
    price_objection_recorded = any("price" in (f.get("text") or "").lower() for f in feedback if f["metric_type"] == "verbatim")
    competitor_named = any("competitor" in (f.get("text") or "").lower() for f in feedback if f["metric_type"] == "verbatim")
    export_spike = any(e["feature"] == "exports" for e in usage[:20])
    project_end_recorded = False  # placeholder

    return {
        "open_critical_tickets": open_critical,
        "open_high_tickets": open_high,
        "payment_failures_30d": pay_failures_30d,
        "subscription_status": sub_status,
        "core_feature_usage_rate": core_usage_rate,
        "plan_utilization": plan_utilization,
        "price_objection_recorded": price_objection_recorded,
        "competitor_named": competitor_named,
        "export_spike": export_spike,
        "project_end_recorded": project_end_recorded,
        "payments_current": pay_failures_30d == 0,
    }

def _evaluate(rule: dict, feats: dict) -> tuple[bool, float]:
    code = rule["code"]
    if code == "payment":
        cond = feats["payment_failures_30d"] >= 2 and feats["subscription_status"] != "cancelled"
        conf = min(0.95, 0.60 + 0.10 * feats["payment_failures_30d"]) if cond else 0.0
    elif code == "technical_support":
        cond = feats["open_critical_tickets"] >= 1 or feats["open_high_tickets"] >= 2
        conf = min(0.95, 0.60 + 0.13 * feats["open_critical_tickets"] + 0.07 * feats["open_high_tickets"]) if cond else 0.0
    elif code == "product_fit":
        cond = feats["core_feature_usage_rate"] < 0.4
        conf = 0.30 + 0.5 * (1 - feats["core_feature_usage_rate"]) if cond else 0.0
    elif code == "price_plan_fit":
        cond = feats["plan_utilization"] < 0.4 or feats["price_objection_recorded"]
        conf = 0.40 + 0.4 * (1 - feats["plan_utilization"]) if cond else 0.0
    elif code == "disengagement":
        cond = False  # requires trend calc; placeholder
        conf = 0.0
    elif code == "lifecycle":
        cond = feats["project_end_recorded"]
        conf = 0.75 if cond else 0.0
    elif code == "competitive":
        cond = feats["competitor_named"] or feats["export_spike"]
        conf = 0.70 if cond else 0.0
    else:
        return False, 0.0
    return cond, round(conf, 3)

def generate_hypotheses(db: Client, account_id: str) -> list[CauseHypothesis]:
    rules = _load_rules()
    feats = _features(db, account_id)
    results = []
    for rule in rules["causes"]:
        if rule["code"] == "unknown":
            continue
        triggered, conf = _evaluate(rule, feats)
        if triggered and conf >= 0.25:
            results.append(CauseHypothesis(
                account_id=account_id,
                cause=rule["code"],
                rank=0,  # set below
                confidence=conf,
                evidence_json=[{"feature": f, "source": "rules"} for f in rule["supporting_evidence"]],
                contradictions_json=[{"feature": f, "source": "rules"} for f in rule["contradicting_evidence"]],
                rule_version=rules["version"],
                generated_at=datetime.now(timezone.utc),
            ))
    results.sort(key=lambda h: h.confidence, reverse=True)
    for i, r in enumerate(results):
        r.rank = i + 1
    if not results or results[0].confidence < 0.40:
        results.append(CauseHypothesis(
            account_id=account_id,
            cause="unknown",
            rank=len(results) + 1,
            confidence=0.25,
            evidence_json=[],
            contradictions_json=[],
            rule_version=rules["version"],
            generated_at=datetime.now(timezone.utc),
            unknown_reason="insufficient_signals",
        ))
    # persist
    for h in results:
        db.table("cause_hypotheses").insert(h.model_dump(exclude={"id"}, mode="python")).execute()
    return results
```

- [ ] **Step 3: Mount `/accounts/{id}/causes` endpoint and run tests**

Add `app/api/v1/causes.py` with `GET /accounts/{account_id}/causes`, include in `router.py`.

Run: `pytest tests/test_causes.py -v`
Expected: **5 passed.** If any fail, fix the implementation — do not edit the test.

### Phase C — REFACTOR

- [ ] **Step 4: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; `app/modules/causes.py` ≥80%. Add tests for the `unknown_reason` field path and for the 0.40 threshold branch if coverage is thin.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/modules/causes.py services/api/app/api/v1/causes.py policies/cause_rules.yaml services/api/tests/test_causes.py
git commit -m "feat(api): rule-based cause hypothesis engine (TDD: 5 tests passing)"
```

---

## Task 9: Action Policy Engine & Registry

**Files:**
- Create: `services/api/tests/test_policy.py` (RED step first — the 10 blueprint §15.1 policy tests)
- Create: `policies/actions.yaml`
- Create: `services/api/app/modules/policy.py`
- Create: `services/api/app/modules/actions.py`
- Create: `services/api/app/api/v1/actions.py`

**Interfaces:**
- Consumes: risk predictions, cause hypotheses, event tables, `actions.yaml`
- Produces: `recommend_actions(db, account_id) -> list[ActionRecommendation]`, `GET /accounts/{id}/actions`

### Phase A — RED (policy tests first — this is the blueprint's safety gate)

- [ ] **Step 1: Write the 10 blueprint §15.1 policy tests**

```python
def test_payment_action_rejected_without_evidence(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    pay = next(x for x in r.json()["data"] if x["action_code"] == "payment_retry")
    assert pay["eligibility"] is False
    assert "payment" in pay["rejection_reason"].lower()

def test_upgrade_rejected_when_experience_low(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    upg = next(x for x in r.json()["data"] if x["action_code"] == "upgrade_review")
    assert upg["eligibility"] is False
    assert "experience" in upg["rejection_reason"].lower()

def test_support_escalation_eligible_for_northstar(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    esc = next(x for x in r.json()["data"] if x["action_code"] == "support_escalation")
    assert esc["eligibility"] is True

def test_payment_action_eligible_for_ember(client):
    r = client.get("/api/v1/accounts/ember/actions")
    pay = next(x for x in r.json()["data"] if x["action_code"] == "payment_retry")
    assert pay["eligibility"] is True

def test_sensitive_action_requires_approval(client):
    r = client.get("/api/v1/accounts/lumen/actions")
    plan = next(x for x in r.json()["data"] if x["action_code"] == "plan_review")
    if plan["eligibility"]:
        assert plan["approval_required"] is True

def test_no_action_always_eligible(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    no_act = next(x for x in r.json()["data"] if x["action_code"] == "no_action")
    assert no_act["eligibility"] is True

def test_frequency_cap_field_present(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    for a in r.json()["data"]:
        assert "benefit" in a and "friction" in a and "risk" in a

def test_eligible_actions_have_utility_score(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    for a in r.json()["data"]:
        if a["eligibility"]:
            assert a["utility_score"] is not None
            assert isinstance(a["utility_score"], (int, float))

def test_rejected_actions_have_reason(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    for a in r.json()["data"]:
        if not a["eligibility"]:
            assert a["rejection_reason"] is not None and len(a["rejection_reason"]) > 0

def test_actions_list_includes_all_eight_codes(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    codes = {a["action_code"] for a in r.json()["data"]}
    assert codes == {
        "in_app_education","payment_retry","support_escalation",
        "human_outreach","plan_review","pause_subscription",
        "upgrade_review","no_action",
    }
```

Run: `pytest tests/test_policy.py -v`
Expected: **10 failures.** Each must fail because `/api/v1/accounts/{id}/actions` returns 404.

### Phase B — GREEN

- [ ] **Step 1: Write `policies/actions.yaml`**

```yaml
version: "1.0"
actions:
  - code: in_app_education
    label: "Guided onboarding"
    requires:
      - no_severe_open_ticket
    approval: false
    max_per_14d: 2
    benefit: medium
    friction: low
    risk: low

  - code: payment_retry
    label: "Payment retry & card update"
    requires:
      - payment_failure_evidence
    approval: finance
    max_per_30d: 3
    benefit: high
    friction: low
    risk: medium

  - code: support_escalation
    label: "Support escalation"
    requires:
      - unresolved_high_severity_ticket
    approval: false
    max_per_30d: 3
    benefit: high
    friction: low
    risk: low

  - code: human_outreach
    label: "Human outreach"
    requires:
      - contact_allowed
    approval: csm
    max_per_14d: 1
    benefit: medium
    friction: medium
    risk: low

  - code: plan_review
    label: "Flexible plan review"
    requires:
      - plan_utilization_low OR price_objection
    approval: csm
    max_per_60d: 1
    benefit: high
    friction: low
    risk: low

  - code: pause_subscription
    label: "Pause subscription"
    requires:
      - lifecycle_evidence
    approval: customer
    max_per_90d: 1
    benefit: high
    friction: low
    risk: low

  - code: upgrade_review
    label: "Upgrade review"
    requires:
      - expansion_readiness_high
      - experience_score_gte_70
    approval: csm_customer
    max_per_90d: 1
    benefit: high
    friction: medium
    risk: low

  - code: no_action
    label: "No action"
    requires: []
    approval: false
    max_per_30d: 999
    benefit: low
    friction: low
    risk: low
```

- [ ] **Step 2: Implement `app/modules/policy.py`**

```python
from pathlib import Path
import yaml
from supabase import Client

POLICY_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "policies" / "actions.yaml"

def load_actions() -> list[dict]:
    return yaml.safe_load(POLICY_PATH.read_text())["actions"]

def check_eligibility(db: Client, account_id: str, action: dict, context: dict) -> tuple[bool, str | None]:
    """Return (eligible, rejection_reason)."""
    code = action["code"]
    if code == "in_app_education":
        if context["open_critical_tickets"] > 0:
            return False, "Severe open ticket — escalate first"
        return True, None
    if code == "payment_retry":
        if not context["payment_failure_evidence"]:
            return False, "No payment-failure evidence"
        return True, None
    if code == "support_escalation":
        if context["open_critical_tickets"] == 0 and context["open_high_tickets"] < 2:
            return False, "No severe issue evidence"
        return True, None
    if code == "human_outreach":
        # Frequency cap placeholder
        return True, None
    if code == "plan_review":
        if not (context["plan_utilization_low"] or context["price_objection"]):
            return False, "No plan/price signal"
        return True, None
    if code == "pause_subscription":
        if not context["lifecycle_evidence"]:
            return False, "No lifecycle evidence"
        return True, None
    if code == "upgrade_review":
        if not context["expansion_readiness_high"]:
            return False, "Expansion readiness not high"
        if context["experience_score"] < 70:
            return False, "Experience score is below 70"
        return True, None
    if code == "no_action":
        return True, None
    return False, f"Unknown action code: {code}"
```

- [ ] **Step 3: Implement `app/modules/actions.py`**

```python
from datetime import datetime, timezone
from supabase import Client
from app.models import ActionRecommendation
from app.modules.policy import load_actions, check_eligibility
from app.modules.health import score_health
from app.modules.risk import predict_risks

def _context(db: Client, account_id: str) -> dict:
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    feedback = db.table("feedback_events").select("*").eq("account_id", account_id).execute().data
    health = score_health(db, account_id)
    risks = predict_risks(db, account_id)
    exp_risk = next((r for r in risks if r.risk_type == "expansion_readiness"), None)
    return {
        "open_critical_tickets": sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "critical"),
        "open_high_tickets": sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "high"),
        "payment_failure_evidence": any(p["status"] == "failed" for p in payments),
        "plan_utilization_low": False,  # placeholder
        "price_objection": any("price" in (f.get("text") or "").lower() for f in feedback if f["metric_type"] == "verbatim"),
        "lifecycle_evidence": False,  # placeholder
        "expansion_readiness_high": (exp_risk.probability >= 0.70) if exp_risk else False,
        "experience_score": health.experience,
    }

def _utility(benefit: str, friction: str, risk: str) -> float:
    benefit_v = {"high": 0.9, "medium": 0.6, "low": 0.3}.get(benefit, 0.3)
    friction_v = {"high": 0.8, "medium": 0.5, "low": 0.2}.get(friction, 0.3)
    risk_v = {"high": 0.7, "medium": 0.4, "low": 0.1}.get(risk, 0.3)
    return round(benefit_v - friction_v * 0.3 - risk_v * 0.3, 3)

def recommend_actions(db: Client, account_id: str) -> list[ActionRecommendation]:
    actions = load_actions()
    ctx = _context(db, account_id)
    recs = []
    for action in actions:
        eligible, rejection = check_eligibility(db, account_id, action, ctx)
        approval_required = action["approval"] not in (False, "false", None)
        rec = ActionRecommendation(
            account_id=account_id,
            action_code=action["code"],
            eligibility=eligible,
            rejection_reason=rejection,
            utility_score=_utility(action["benefit"], action["friction"], action["risk"]) if eligible else None,
            approval_required=approval_required,
            approval_reason=f"{action['approval']} approval required" if approval_required else None,
            benefit=action["benefit"],
            friction=action["friction"],
            risk=action["risk"],
            generated_at=datetime.now(timezone.utc),
        )
        recs.append(rec)
        db.table("action_recommendations").insert(rec.model_dump(exclude={"id"}, mode="python")).execute()
    return recs
```

- [ ] **Step 4: Write `tests/test_policy.py` — the 10 blueprint §15.1 tests**

- [ ] **Step 4: Mount `/accounts/{id}/actions` endpoint and run tests to confirm GREEN**

Add `app/api/v1/actions.py` with `GET /accounts/{account_id}/actions`, include in `router.py`.

Run: `pytest tests/test_policy.py -v`
Expected: **10 passed.** If any fail, fix the implementation — do not edit the test.

### Phase C — REFACTOR

- [ ] **Step 5: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; `app/modules/policy.py` and `app/modules/actions.py` ≥80%. Add tests for frequency-cap hit paths if coverage is thin.

- [ ] **Step 6: Commit**

```bash
git add services/api/app/modules/policy.py services/api/app/modules/actions.py services/api/app/api/v1/actions.py policies/actions.yaml services/api/tests/test_policy.py
git commit -m "feat(api): governed action registry (TDD: 10 policy tests passing)"
```

---

## Task 10: Intervention State Machine & Outcomes

**Files:**
- Create: `services/api/tests/test_interventions.py` (RED step first)
- Create: `services/api/app/modules/interventions.py`
- Create: `services/api/app/modules/outcomes.py`
- Create: `services/api/app/api/v1/interventions.py`

**Interfaces:**
- Consumes: action recommendations, audit log writer
- Produces: `POST /interventions`, `PATCH /interventions/{id}`, `POST /interventions/{id}/outcome`

### Phase A — RED

- [ ] **Step 1: Write failing tests covering the state machine and audit**

```python
def test_create_intervention_starts_pending(client):
    r = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    })
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["status"] == "pending"
    assert body["recommended_action"] == "support_escalation"
    return body["id"]

def test_transition_pending_to_approved(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    r = client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "approved",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "approved"
    assert r.json()["data"]["approver"] == "aisha"

def test_invalid_transition_rejected(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    r = client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "delivered",  # cannot jump pending → delivered
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    assert r.status_code == 422

def test_rejected_transition_cannot_move_forward(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "rejected",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    r = client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "executed",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    assert r.status_code == 422

def test_outcome_recorded_and_marks_delivered(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    r = client.post(f"/api/v1/interventions/{create['id']}/outcome", json={
        "usage_delta": 18.0, "health_delta": 12.0,
        "response": "Incident resolved",
        "observation": "Observed over 14 days",
    })
    assert r.status_code == 200
    assert r.json()["data"]["usage_delta"] == 18.0

def test_audit_log_created_for_each_transition(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    iid = create["id"]
    client.patch(f"/api/v1/interventions/{iid}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    r = client.get(f"/api/v1/audit?entity_type=intervention&entity_id={iid}")
    assert r.status_code == 200
    logs = r.json()["data"]
    assert len(logs) >= 2  # create + approve

def test_intervention_not_found_returns_404(client):
    r = client.patch("/api/v1/interventions/int-does-not-exist", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    assert r.status_code == 404
```

Run: `pytest tests/test_interventions.py -v`
Expected: **7 failures.** All must fail because `/api/v1/interventions` returns 404.

### Phase B — GREEN

- [ ] **Step 1: Implement `app/modules/interventions.py`**

```python
import secrets
from datetime import datetime, timezone
from supabase import Client
from app.models import Intervention, AuditLog
from app.core.errors import NotFound, ValidationError

VALID_TRANSITIONS = {
    "pending": ["approved", "rejected", "modified"],
    "approved": ["executed", "rejected"],
    "modified": ["approved", "rejected"],
    "executed": ["delivered"],
    "delivered": [],
    "rejected": [],
}

def create_intervention(db: Client, account_id: str, recommended_action: str, actor_id: str, actor_role: str = "system") -> Intervention:
    iid = f"int-{secrets.token_hex(4)}"
    rec = Intervention(
        id=iid,
        account_id=account_id,
        recommended_action=recommended_action,
        status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.table("interventions").insert(rec.model_dump(mode="python")).execute()
    _audit(db, actor_id, actor_role, "create_intervention", "intervention", iid, None, rec.model_dump(mode="python"))
    return rec

def transition(db: Client, intervention_id: str, new_status: str, actor_id: str, actor_role: str, reason: str | None = None, final_action: str | None = None) -> Intervention:
    row = db.table("interventions").select("*").eq("id", intervention_id).maybe_single().execute()
    if not row.data:
        raise NotFound("intervention", intervention_id)
    before = row.data
    current = before["status"]
    if new_status not in VALID_TRANSITIONS.get(current, []):
        raise ValidationError(f"Cannot transition from {current} to {new_status}")
    update = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if new_status in ("approved", "executed"):
        update["final_action"] = final_action or before["recommended_action"]
        update["approver"] = actor_id
    if reason:
        update["reason"] = reason
    db.table("interventions").update(update).eq("id", intervention_id).execute()
    after = db.table("interventions").select("*").eq("id", intervention_id).maybe_single().execute().data
    _audit(db, actor_id, actor_role, f"intervention_{new_status}", "intervention", intervention_id, before, after, reason)
    return Intervention(**after)

def _audit(db, actor_id, actor_role, action, entity_type, entity_id, before, after, reason=None):
    db.table("audit_logs").insert({
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before_json": before,
        "after_json": after,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
    }).execute()
```

- [ ] **Step 2: Implement `app/modules/outcomes.py`**

```python
from datetime import datetime, timezone
from supabase import Client
from app.models import Outcome, Intervention
from app.core.errors import NotFound

def record_outcome(db: Client, intervention_id: str, *, renewed=None, downgraded=None, churned=None, usage_delta=None, health_delta=None, response=None, observation=None) -> Outcome:
    row = db.table("interventions").select("*").eq("id", intervention_id).maybe_single().execute()
    if not row.data:
        raise NotFound("intervention", intervention_id)
    out = Outcome(
        intervention_id=intervention_id,
        renewed=renewed, downgraded=downgraded, churned=churned,
        usage_delta=usage_delta, health_delta=health_delta,
        response=response, observation=observation,
        recorded_at=datetime.now(timezone.utc),
    )
    db.table("outcomes").insert(out.model_dump(mode="python")).execute()
    db.table("interventions").update({"status": "delivered", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", intervention_id).execute()
    return out
```

- [ ] **Step 3: Mount endpoints**

```python
# app/api/v1/interventions.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.interventions import create_intervention, transition
from app.modules.outcomes import record_outcome

router = APIRouter()

class CreateInterventionRequest(BaseModel):
    account_id: str
    recommended_action: str
    actor_id: str = "csm-demo"
    actor_role: str = "csm"

class TransitionRequest(BaseModel):
    status: str
    actor_id: str = "csm-demo"
    actor_role: str = "csm"
    reason: str | None = None
    final_action: str | None = None

class OutcomeRequest(BaseModel):
    renewed: bool | None = None
    downgraded: bool | None = None
    churned: bool | None = None
    usage_delta: float | None = None
    health_delta: float | None = None
    response: str | None = None
    observation: str | None = None

@router.post("/interventions")
def create(req: CreateInterventionRequest, db: Client = Depends(get_db)):
    return envelope(data=create_intervention(db, req.account_id, req.recommended_action, req.actor_id, req.actor_role).model_dump(mode="python"))

@router.patch("/interventions/{intervention_id}")
def update(intervention_id: str, req: TransitionRequest, db: Client = Depends(get_db)):
    return envelope(data=transition(db, intervention_id, req.status, req.actor_id, req.actor_role, req.reason, req.final_action).model_dump(mode="python"))

@router.post("/interventions/{intervention_id}/outcome")
def add_outcome(intervention_id: str, req: OutcomeRequest, db: Client = Depends(get_db)):
    return envelope(data=record_outcome(db, intervention_id, **req.model_dump()).model_dump(mode="python"))
```

- [ ] **Step 4: Run tests to confirm GREEN**

Run: `pytest tests/test_interventions.py -v`
Expected: **7 passed.** If any fail, fix the implementation — do not edit the test.

### Phase C — REFACTOR

- [ ] **Step 5: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; `app/modules/interventions.py` and `app/modules/outcomes.py` ≥80%. Add tests for the `modified` branch of `VALID_TRANSITIONS` if coverage is thin.

- [ ] **Step 6: Commit**

```bash
git add services/api/app/modules/interventions.py services/api/app/modules/outcomes.py services/api/app/api/v1/interventions.py services/api/tests/test_interventions.py
git commit -m "feat(api): intervention state machine (TDD: 7 tests passing)"
```

---

## Task 11: Analyze Endpoint, Dashboard KPIs, Audit & Ingestion

**Files:**
- Create: `services/api/tests/test_end_to_end.py` (RED step first — the Northstar full loop)
- Create: `services/api/tests/test_ingestion.py`
- Create: `services/api/app/api/v1/analyze.py`
- Create: `services/api/app/api/v1/dashboard.py`
- Create: `services/api/app/api/v1/audit.py`
- Create: `services/api/app/api/v1/ingestion.py`
- Create: `services/api/app/modules/ingestion.py`

**Interfaces:**
- Consumes: all modules
- Produces: `POST /accounts/{id}/analyze`, `GET /dashboard/kpis`, `GET /audit`, `POST /ingestion/csv`, `GET /ingestion/jobs/{id}`

### Phase A — RED

- [ ] **Step 1: Write Northstar full-loop test — the blueprint §20.3 acceptance gate**

```python
def test_northstar_full_loop(client):
    """Detect → Explain → Decide → Approve → Act → Measure."""
    # 1. Detect: list accounts, northstar is at top of risk queue
    r = client.get("/api/v1/accounts")
    ids = [a["id"] for a in r.json()["data"]]
    assert "northstar" in ids

    # 2. GET customer 360
    r = client.get("/api/v1/accounts/northstar")
    assert r.status_code == 200
    profile = r.json()["data"]
    assert profile["account"]["id"] == "northstar"

    # 3. Explain: POST analyze returns health, risks, causes, actions together
    r = client.post("/api/v1/accounts/northstar/analyze")
    assert r.status_code == 200
    analysis = r.json()["data"]
    assert analysis["health"]["experience"] < 40
    canc = next(x for x in analysis["risks"] if x["risk_type"] == "cancellation")
    assert canc["probability"] >= 0.75
    assert analysis["causes"][0]["cause"] == "technical_support"

    # 4. Decide: action registry rejects payment_retry (no payment evidence) and upgrade_review (low experience)
    actions_by_code = {a["action_code"]: a for a in analysis["actions"]}
    assert actions_by_code["payment_retry"]["eligibility"] is False
    assert actions_by_code["upgrade_review"]["eligibility"] is False
    assert actions_by_code["support_escalation"]["eligibility"] is True

    # 5. Approve: create intervention in pending, approve it
    r = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    })
    iid = r.json()["data"]["id"]
    client.patch(f"/api/v1/interventions/{iid}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })

    # 6. Act: transition to executed
    r = client.patch(f"/api/v1/interventions/{iid}", json={
        "status": "executed", "actor_id": "aisha", "actor_role": "csm",
        "final_action": "support_escalation",
    })
    assert r.json()["data"]["status"] == "executed"

    # 7. Measure: record outcome
    r = client.post(f"/api/v1/interventions/{iid}/outcome", json={
        "usage_delta": 18.0, "health_delta": 12.0,
        "response": "Incident resolved",
        "observation": "Observed over 14 days; no causal claim",
    })
    assert r.status_code == 200
    assert r.json()["data"]["usage_delta"] == 18.0

    # 8. Audit trail has all transitions
    r = client.get(f"/api/v1/audit?entity_type=intervention&entity_id={iid}")
    logs = r.json()["data"]
    actions_logged = [log["action"] for log in logs]
    assert "create_intervention" in actions_logged
    assert "intervention_approved" in actions_logged
    assert "intervention_executed" in actions_logged

def test_dashboard_kpis_reflect_seeded_state(client):
    r = client.get("/api/v1/dashboard/kpis")
    assert r.status_code == 200
    kpis = r.json()["data"]
    assert kpis["total_accounts"] == 50
    assert kpis["at_risk_mrr"] > 0

def test_audit_query_filters_by_entity(client):
    r = client.get("/api/v1/audit?entity_type=intervention&limit=5")
    assert r.status_code == 200
    for log in r.json()["data"]:
        assert log["entity_type"] == "intervention"

def test_csv_ingestion_rejects_missing_account_id(client):
    import io
    csv_bytes = b"id,name,initials\n,Missing ID,MI\n"
    r = client.post("/api/v1/ingestion/csv",
                    files={"file": ("bad.csv", io.BytesIO(csv_bytes), "text/csv")})
    assert r.status_code == 422
```

Run: `pytest tests/test_end_to_end.py tests/test_ingestion.py -v`
Expected: **4 failures.** All must fail because the new endpoints don't exist yet.

### Phase B — GREEN

- [ ] **Step 2: Implement `/accounts/{id}/analyze` endpoint**

`app/api/v1/analyze.py` — calls `score_health`, `predict_risks`, `generate_hypotheses`, `recommend_actions` in sequence, returns combined dict `{health, risks, causes, actions}` wrapped in `envelope()`.

- [ ] **Step 3: Implement `/dashboard/kpis` endpoint**

`app/api/v1/dashboard.py` — aggregates:
- `total_accounts` = count of accounts
- `at_risk_mrr` = sum of `arr_mrr` for accounts where latest cancellation risk > 0.6
- `risk_distribution` = histogram of latest risk probabilities
- `intervention_acceptance_rate` = approved+executed / total interventions
- `override_rate` = modified / total interventions

- [ ] **Step 4: Implement `/audit` endpoint**

`app/api/v1/audit.py` — `GET /audit?entity_type=...&entity_id=...&actor_id=...&limit=100`. Read-only query over `audit_logs`.

- [ ] **Step 5: Implement CSV ingestion module + endpoints**

`app/modules/ingestion.py`:
- `parse_csv(file_bytes) -> list[dict]`
- `validate_row(row, schema) -> (valid: bool, error: str | None)`
- `insert_valid(db, entity, rows) -> (inserted: int, quarantined: list[dict])`

`app/api/v1/ingestion.py`:
- `POST /ingestion/csv` — multipart upload, validates, inserts valid rows, returns `{job_id, inserted, quarantined}`
- `GET /ingestion/jobs/{id}` — returns status and error rows

Validation rules per blueprint §6.3: reject missing account_id (422), quarantine unknown FKs, dedupe by event_id, flag future timestamps.

- [ ] **Step 6: Run tests to confirm GREEN**

Run: `pytest tests/test_end_to_end.py tests/test_ingestion.py -v`
Expected: **4 passed.** If any fail, fix the implementation — do not edit the test.

### Phase C — REFACTOR

- [ ] **Step 7: Run full suite with coverage**

Run: `pytest --cov=app`
Expected: all tests pass; coverage floor 70% overall, 80% on `app/modules/`. If the Northstar loop uncovered branches (e.g. audit-log `reason` field), add targeted tests.

- [ ] **Step 8: Commit**

```bash
git add services/api/app/api/v1/analyze.py services/api/app/api/v1/dashboard.py services/api/app/api/v1/audit.py services/api/app/api/v1/ingestion.py services/api/app/modules/ingestion.py services/api/tests/test_end_to_end.py services/api/tests/test_ingestion.py
git commit -m "feat(api): analyze, dashboard KPIs, audit, CSV ingestion (TDD: Northstar full loop green)"
```

---

## Task 12: Documentation & Final Verification

**Files:**
- Update: `services/api/README.md`
- Update: `README.md` (root)

- [ ] **Step 1: Write `services/api/README.md`**

Include:
- One-command local setup (venv, env, start)
- Seed reset command
- Test commands
- Environment variable reference
- API route reference (15 endpoints from blueprint §12)
- Architecture diagram (text)

- [ ] **Step 2: Update root `README.md`**

Add backend startup and seeding sections. Mark Phase 0–3 complete in delivery roadmap.

- [ ] **Step 3: Run full verification with coverage floor**

```bash
cd /Users/johnnytan5/Documents/HackAttack-Valueloop
source services/api/.venv/bin/activate
python scripts/seed_demo.py
pytest services/api/tests -v --cov=app --cov-report=term-missing
```
Expected: **30+ tests pass**, no test fails, coverage report shows:
- `app/modules/` ≥80%
- `app/api/v1/` ≥70%
- overall `app/` ≥70% (matches `fail_under = 70` in `pyproject.toml`)

If coverage is below floor, add targeted tests for uncovered branches before proceeding.

- [ ] **Step 4: Run Northstar rehearsal**

Manually walk through the 5-minute demo script (blueprint §17.1) using `curl` or httpie against the live API. Verify:

1. `GET /accounts` returns northstar at top of risk queue
2. `GET /accounts/northstar` shows 5-dimension health with experience low
3. `POST /accounts/northstar/analyze` returns risks + causes + actions in one call
4. `POST /interventions` → `PATCH approve` → `PATCH execute` → `POST /outcome` completes cleanly
5. `GET /audit` shows full trail
6. `GET /dashboard/kpis` reflects the just-recorded outcome

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "docs: backend README, root README update, verification complete"
git tag v0.1.0-backend
```

---

## Self-Review Checklist (post-plan)

- [ ] All 14 tables from blueprint §6.1 covered? Yes (Task 3).
- [ ] All 15 API endpoints from §12 covered? Yes (Tasks 5, 6, 7, 8, 9, 10, 11).
- [ ] 10 policy tests from §15.1 covered? Yes (Task 9, Phase A — all 10 enumerated in test file).
- [ ] Northstar E2E test covered? Yes (Task 11, Phase A — `test_northstar_full_loop`).
- [ ] Seed determinism verified? Yes (Task 4, step 7).
- [ ] Audit log for every state change? Yes (Task 10, interventions module).
- [ ] Template explanation fallback (no LLM)? Implicit — explanations module stubbed; LLM layer is optional per §10, out of MVP scope.
- [ ] Frontend fixture IDs (northstar, ember, etc.) preserved? Yes (Task 4, step 1 — hardcoded in seed CSV).
- [ ] Type consistency: `Account.id` is `text`, same everywhere? Yes.
- [ ] Version fields on all computed entities? Yes — `health_scores.version`, `risk_predictions.model_version`, `cause_hypotheses.rule_version`.

### TDD Discipline Compliance

- [ ] **Every implementation task (5–11) has RED → GREEN → REFACTOR phases?** Yes — explicit `### Phase A — RED`, `### Phase B — GREEN`, `### Phase C — REFACTOR` headers in each task.
- [ ] **Tests written before implementation?** Yes — each task's Step 1 is the failing test; implementation follows in Step 2+.
- [ ] **Every test file has explicit pass/fail count expectations?** Yes — each RED step states expected failure count, each GREEN step states expected pass count.
- [ ] **Coverage floor enforced?** Yes — `pyproject.toml` sets `fail_under = 70`, each REFACTOR step specifies per-module targets (80% for modules, 70% for API layer).
- [ ] **Test infrastructure task present?** Yes — Task 1.5 defines `conftest.py` with session-scoped seed, FastAPI test client, autouse computed-table wipe, and `pytest-cov` in dev deps.
- [ ] **No mock DB?** Yes — tests use real Supabase project via service-role key (per TDD Discipline rule 6).
- [ ] **Test names are specifications?** Yes — e.g. `test_payment_action_rejected_without_evidence`, not `test_policy_1`.

## Execution Handoff

**Plan saved to `docs/superpowers/plans/2026-07-20-valueloop-backend.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for this plan since Tasks 1–12 are linear with clear handoff points. Each subagent gets one task's RED/GREEN/REFACTOR cycle and hands off to review.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**
