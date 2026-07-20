# Production testing

ValueLoop uses a layered suite so deterministic checks stay fast while tests that mutate the live synthetic Supabase project remain deliberate.

## Test matrix

| Layer | Tool | Coverage |
| --- | --- | --- |
| Backend unit | pytest | Health bounds/defaults, risk clamps, all policy gates, action utility, cause branches, CSV parsing/quarantine, freshness, typed models |
| Backend contract/security | FastAPI TestClient | OpenAPI routes, standard error envelopes, safe 500s, query bounds, upload limits, CORS allowlist, security headers |
| Backend integration | pytest + Supabase | Accounts, ingestion, health, risks, causes, actions, interventions, outcomes, audit, dashboards |
| Backend E2E | pytest + Supabase | Northstar Detect → Explain → Decide → Approve → Act → Measure |
| Backend performance | pytest + Supabase | 3-second account-list and 2-second analysis budgets after warm-up |
| Frontend unit/contract | Vitest + Node test | Typed API requests, adapters, route/API source contract, errors, multipart uploads |
| Frontend component/integration | Testing Library + SWR | Application shell, navigation, tutorial, hooks, live adapters, offline fallback |
| Frontend browser E2E | Playwright | Every route, console/page errors, keyboard path, governed workflow, mobile overflow, performance |
| Accessibility | axe-core + Playwright | WCAG 2 A/AA serious and critical violations on overview, Customer 360, and approvals |

## Fast local verification

```bash
cd services/api
python -m pip install -e ".[dev]"
ruff check app tests
python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=65

cd ../../apps/web
npm ci
npm run test:contract
npm run test:coverage
npm run typecheck
npm run lint
npm run build
```

The backend command skips tests marked `integration` unless explicitly enabled. This prevents an ordinary test run from wiping and reseeding a shared Supabase project.

## Browser release suite

```bash
cd apps/web
npx playwright install chromium
npm run test:e2e
```

Playwright builds and serves the app on port 3100, intercepts API calls with deterministic envelopes, and retains traces, screenshots, and video on failure.

## Live Supabase release gate

Point `.env` at a disposable synthetic test project with the migration applied. The fixture resets computed tables and reruns `scripts/seed_demo.py`; never point it at production or real customer data.

```powershell
cd services/api
$env:RUN_INTEGRATION_TESTS = "1"
python -m pytest -m integration --cov=app --cov-report=term-missing --cov-fail-under=70
```

```bash
cd services/api
RUN_INTEGRATION_TESTS=1 python -m pytest -m integration --cov=app --cov-report=term-missing --cov-fail-under=70
RUN_INTEGRATION_TESTS=1 python -m pytest -m "integration and performance"
```

Authentication and role enforcement are not represented as passing tests because Supabase Auth is still Phase 5 work. Add negative anonymous/CSM/manager authorization tests before claiming production authentication readiness.
