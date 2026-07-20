# ValueLoop Frontend → Backend Integration Plan

**Date:** 2026-07-20
**Status:** Draft
**Branch:** `backend` (API live), frontend integration TBD
**Backend:** 15/15 endpoints, 56 tests, 94.71% coverage — shipped

## Context

The frontend (`apps/web/`) is 100% fixture-driven — zero network calls. All data comes from `lib/mock-data.ts` (9 accounts, 8 churn profiles, trend arrays). The backend has real Supabase data for 50 accounts with computed health, risks, causes, actions, interventions, outcomes, and audit logs.

**Goal:** Connect the frontend to the live API while preserving the existing UI, motion, and guided-demo experience.

---

## Current State

| Aspect | Frontend | Backend |
|---|---|---|
| Data source | `lib/mock-data.ts` (static imports) | Supabase PostgreSQL (50 accounts, 14 tables) |
| Data fetch | None — no `fetch`, no API client | FastAPI, 15 endpoints, response envelope `{data, meta, errors}` |
| Auth | None | None (service-role key, CORS configured for Vercel + localhost) |
| State | `useState` only, no cache | Stateless per-request |
| Accounts | 9 named fixtures | 50 accounts (9 named + 41 generated) |
| Churn profiles | 8 hand-authored pathways | Per-account computed (health, risks, causes, actions) |

---

## Integration Strategy: Adapter Layer

**Do not rewrite the frontend types.** The `ChurnProfile`, `Account`, and related types are deeply embedded in ~350 lines of `value-loop-app.tsx` and child components. Instead:

1. Create `lib/api.ts` — thin fetch client that unwraps the response envelope
2. Create `lib/adapters.ts` — transforms backend shapes → frontend types
3. Replace mock imports with API calls + adapters, one page at a time
4. Keep mock data as fallback when API is unreachable (offline/demo mode)

---

## Phase 0: Foundation (Day 1)

### Task F1: API Client

**File:** `apps/web/lib/api.ts`

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const envelope = await res.json();
  if (envelope.errors?.length) throw new Error(envelope.errors[0].message);
  return envelope.data as T;
}

export const getAccounts = () => api<Account[]>('/accounts');
export const getCustomer360 = (id: string) => api<Customer360>(`/accounts/${id}`);
export const getTimeline = (id: string) => api<TimelineEvent[]>(`/accounts/${id}/timeline`);
export const analyzeAccount = (id: string) => api<Analysis>(`/accounts/${id}/analyze`, { method: 'POST' });
export const getDashboardKPIs = () => api<KPIs>('/dashboard/kpis');
export const getInterventions = (status?: string) => api<Intervention[]>(`/interventions${status ? `?status=${status}` : ''}`);
export const createIntervention = (body: any) => api<Intervention>('/interventions', { method: 'POST', body: JSON.stringify(body) });
export const transitionIntervention = (id: string, body: any) => api<Intervention>(`/interventions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const recordOutcome = (id: string, body: any) => api<Outcome>(`/interventions/${id}/outcome`, { method: 'POST', body: JSON.stringify(body) });
export const getAudit = (params: Record<string, string>) => api<AuditLog[]>(`/audit?${new URLSearchParams(params)}`);
```

### Task F2: Backend Types (mirror API response shapes)

**File:** `apps/web/lib/api-types.ts`

Define TypeScript interfaces matching the backend's Pydantic models:
- `Account` (backend shape — `id`, `name`, `initials`, `owner_id`, `plan`, `segment`, `industry`, `arr_mrr`, `start_date`, `renewal_date`)
- `HealthScore` (`adoption`, `engagement`, `experience`, `financial`, `value`, `overall`)
- `RiskPrediction` (`risk_type`, `probability`, `confidence`, `top_features_json`)
- `CauseHypothesis` (`cause`, `rank`, `confidence`, `evidence_json`, `contradictions_json`)
- `ActionRecommendation` (`action_code`, `eligibility`, `rejection_reason`, `utility_score`, `approval_required`, `benefit`, `friction`, `risk`)
- `Intervention` (`id`, `account_id`, `recommended_action`, `status`, `approver`, `final_action`, `reason`)
- `Outcome` (`intervention_id`, `renewed`, `downgraded`, `churned`, `usage_delta`, `health_delta`, `response`, `observation`)
- `AuditLog` (`actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `timestamp`)
- `Analysis` (`health`, `risks`, `causes`, `actions`)
- `KPIs` (`total_accounts`, `at_risk_mrr`, `intervention_acceptance_rate`, `override_rate`)

### Task F3: Adapter Layer

**File:** `apps/web/lib/adapters.ts`

Transform backend shapes → existing frontend types:

```ts
// Backend Account → Frontend Account (with computed fields)
export function adaptAccount(backend: BackendAccount, analysis?: Analysis): FrontendAccount {
  return {
    id: backend.id,
    name: backend.name,
    initials: backend.initials,
    plan: backend.plan,
    segment: backend.segment,
    arr: backend.arr_mrr,
    risk: analysis ? Math.round(analysis.risks[0]?.probability * 100) : 0,
    severity: riskToSeverity(analysis?.risks[0]?.probability),
    churnType: causeToChurnType(analysis?.causes[0]?.cause),
    health: analysis ? Math.round(analysis.health.overall) : 0,
    delta: 0, // TODO: needs historical comparison
    freshness: '8 min ago', // TODO: from sourceFreshness or computed
    action: analysis ? topAction(analysis.actions) : 'no_action',
    // ... other fields
  };
}

// Backend Analysis → Frontend ChurnProfile
export function adaptChurnProfile(analysis: Analysis, account: BackendAccount): FrontendChurnProfile {
  const topRisk = analysis.risks.find(r => r.risk_type === 'cancellation') || analysis.risks[0];
  const topCause = analysis.causes[0];
  const eligibleActions = analysis.actions.filter(a => a.eligibility);
  const rejectedActions = analysis.actions.filter(a => !a.eligibility);

  return {
    accountId: account.id,
    churnType: causeToChurnType(topCause?.cause),
    probability: Math.round((topRisk?.probability || 0) * 100),
    riskDelta: 0, // TODO
    summary: generateSummary(topRisk, topCause),
    health: [
      ['Adoption', analysis.health.adoption, 0, scoreTone(analysis.health.adoption)],
      ['Engagement', analysis.health.engagement, 0, scoreTone(analysis.health.engagement)],
      ['Experience', analysis.health.experience, 0, scoreTone(analysis.health.experience)],
      ['Financial', analysis.health.financial, 0, scoreTone(analysis.health.financial)],
      ['Value', analysis.health.value, 0, scoreTone(analysis.health.value)],
    ],
    causes: [{
      cause: topCause?.cause || 'unknown',
      confidence: topCause?.confidence || 0,
      supporting: (topCause?.evidence_json || []).map(e => ({ text: e.reason, source: e.source, timestamp: e.timestamp })),
      contradicting: (topCause?.contradictions_json || []).map(e => ({ text: e.reason, source: e.source, timestamp: e.timestamp })),
    }],
    action: {
      recommended: eligibleActions[0]?.action_code || 'no_action',
      rejected: rejectedActions.map(a => ({ name: a.action_code, reason: a.rejection_reason })),
      checks: [], // TODO: from policy module
      explanation: '', // TODO
      approvalRequired: eligibleActions[0]?.approval_required || false,
    },
    timeline: [], // filled separately
    outcome: null, // filled separately
  };
}

// Backend KPIs → Frontend dashboard KPIs
export function adaptKPIs(backend: KPIs): FrontendKPIs {
  return {
    totalAccounts: backend.total_accounts,
    atRiskMRR: `RM ${(backend.at_risk_mrr / 1000).toFixed(1)}k`,
    acceptanceRate: `${Math.round(backend.intervention_acceptance_rate * 100)}%`,
    overrideRate: `${Math.round(backend.override_rate * 100)}%`,
    freshness: '8 min ago', // TODO
    atRiskCount: 0, // TODO: needs backend field
  };
}
```

### Task F4: Environment Variable

**File:** `apps/web/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**File:** `apps/web/.env.example`

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Task F5: Update Contract Test

**File:** `apps/web/tests/frontend-contract.test.mjs`

Remove the `doesNotMatch.*fetch` assertion. Replace with:
- Assert `lib/api.ts` exists and exports expected functions
- Assert adapters handle null/empty analysis gracefully
- Assert mock data is still importable (fallback mode)

---

## Phase 1: Core Pages (Days 2–3)

### Task P1-1: Accounts List + Dashboard KPIs (Overview `/`)

**Backend endpoints used:**
- `GET /api/v1/accounts`
- `GET /api/v1/dashboard/kpis`

**Changes in `value-loop-app.tsx`:**
- Replace `import { accounts } from './mock-data'` with `const accounts = useAccounts()` (SWR or useEffect+useState)
- Replace hardcoded KPI strings ("RM 48.0k", "8", "72%") with `adaptKPIs(await getDashboardKPIs())`
- For the top-5 accounts table: fetch accounts, then `analyzeAccount(id)` for each of the first 5 → `adaptAccount(backend, analysis)`

**Fallback:** If API fails, fall back to mock data with a toast notification.

### Task P1-2: Customer 360 (`/accounts/[id]`)

**Backend endpoints used:**
- `GET /api/v1/accounts/{id}`
- `POST /api/v1/accounts/{id}/analyze`
- `GET /api/v1/accounts/{id}/timeline`

**Changes:**
- `getAccountParams()` in `page.tsx` → fetch from API instead of mock lookup
- Replace `getChurnProfile(id)` with `adaptChurnProfile(await analyzeAccount(id), await getCustomer360(id))`
- Replace `sourceFreshness[id]` with `customer360.freshness` (adapt keys)
- Replace `profile.timeline` with `adaptTimeline(await getTimeline(id))`
- Replace `profile.riskHistory` with placeholder (no endpoint yet — show "Coming soon" or use mock)
- Replace `profile.outcome` with placeholder (no per-account outcome endpoint yet)

**Known gaps:**
- `riskHistory` (7-day area chart) — no endpoint, use mock or hide
- Per-account `outcome` — no endpoint, derive from interventions table later

### Task P1-3: Risk Queue (`/risk-queue`)

**Backend endpoints used:**
- `GET /api/v1/accounts`
- `POST /api/v1/accounts/{id}/analyze` (for each account)

**Problem:** N+1 — 50 accounts × 1 analyze call = 50 requests.

**Solution options:**
1. **Backend bulk endpoint** (preferred): Add `GET /api/v1/accounts?include=analysis` that returns accounts with pre-computed analysis
2. **Parallel fetch**: Fire all 50 analyze calls in parallel with `Promise.all`
3. **Lazy load**: Only analyze visible rows (virtualized list)

**Recommendation:** Start with option 2 (parallel fetch), add backend bulk endpoint in Phase 3.

---

## Phase 2: Workflow Pages (Days 4–5)

### Task P2-1: Approvals (`/approvals`)

**Backend gap:** No `GET /api/v1/interventions` list endpoint.

**Backend work needed first:**
```python
# app/api/v1/interventions.py — add:
@router.get("/interventions")
def list_interventions(status: str | None = None, db: Client = Depends(get_db)):
    q = db.table("interventions").select("*")
    if status:
        q = q.eq("status", status)
    result = q.order("created_at", desc=True).execute()
    return envelope(data=result.data or [])
```

**Frontend changes:**
- Fetch pending interventions → join with account data → display approval queue
- Wire approve/reject buttons to `PATCH /interventions/{id}`

### Task P2-2: Outcomes (`/outcomes`)

**Backend gaps:**
- No `GET /api/v1/outcomes` list endpoint
- No time-series aggregation for `outcomeTrend` bar chart

**Backend work needed:**
```python
# app/api/v1/outcomes.py — new file
@router.get("/outcomes")
def list_outcomes(db: Client = Depends(get_db)):
    result = db.table("outcomes").select("*, interventions!inner(account_id)").execute()
    return envelope(data=result.data or [])
```

**Frontend changes:**
- Fetch outcomes → join with account data → display outcomes table
- `outcomeTrend` chart: use mock data until time-series endpoint exists

### Task P2-3: Audit (`/audit`)

**Backend endpoint:** `GET /api/v1/audit` (already exists)

**Frontend changes:**
- Fetch audit logs with filters → `adaptAuditLog(backend)` → display table
- Wire entity_type/entity_id filters to query params

---

## Phase 3: Polish & Performance (Day 6)

### Task P3-1: Introduce SWR for Caching

**File:** `apps/web/lib/use-api.ts`

```ts
import useSWR from 'swr';

export function useAccounts() {
  return useSWR('/accounts', getAccounts, { fallbackData: mockAccounts });
}

export function useCustomer360(id: string) {
  return useSWR(id ? `/accounts/${id}` : null, () => getCustomer360(id));
}

export function useAnalysis(id: string) {
  return useSWR(id ? `/accounts/${id}/analyze` : null, () => analyzeAccount(id));
}
```

**Benefits:**
- Automatic caching (no redundant fetches)
- Loading/error states built-in
- `fallbackData` enables offline/demo mode with mock data

### Task P3-2: Bulk Analyze Endpoint

**Backend:** Add `GET /api/v1/accounts?include=analysis` that returns accounts with pre-computed analysis in one call (avoids N+1 on Risk Queue).

### Task P3-3: Guided Demo Integration

The guided demo (`/guided-demo`) walks through all 6 steps of the Northstar loop. Once all pages are connected:
- Verify the demo still works end-to-end with live data
- Update scenario selector to use real account IDs
- Ensure motion/timing is preserved (no loading spinners breaking the walkthrough)

### Task P3-4: Playbook Studio

Lowest priority — currently read-only mock data. Connect to `GET /accounts/{id}/causes` + `GET /accounts/{id}/actions` for template presets. Saving playbook configs is out of MVP scope.

---

## Backend Gaps to Fill (Before Frontend Can Connect)

| Missing endpoint | Needed by | Priority |
|---|---|---|
| `GET /api/v1/interventions` (list, filterable by status) | Approvals page | P2 |
| `GET /api/v1/outcomes` (list) | Outcomes page | P2 |
| `GET /api/v1/accounts?include=analysis` (bulk) | Risk Queue | P3 |
| `GET /api/v1/dashboard/trend` (MRR time-series) | Overview chart | P3 |
| `GET /api/v1/dashboard/action-mix` (category breakdown) | Overview pie chart | P3 |
| `GET /api/v1/accounts/{id}/risk-history` (7-day scores) | Customer 360 chart | P3 |

---

## Execution Plan

| Phase | Tasks | Duration | Dependencies |
|---|---|---|---|
| **Phase 0** | F1–F5: API client, types, adapters, env, test update | 1 day | Backend shipped |
| **Phase 1** | P1-1, P1-2, P1-3: Overview, Customer 360, Risk Queue | 2 days | Phase 0 |
| **Phase 2** | P2-1, P2-2, P2-3: Approvals, Outcomes, Audit | 2 days | Phase 0 + backend gaps |
| **Phase 3** | P3-1, P3-2, P3-3, P3-4: SWR, bulk, demo, playbooks | 1 day | Phase 1+2 |
| **Total** | | **6 days** | |

---

## Testing Strategy

1. **Adapter unit tests**: Test every adapter function with sample backend responses (including edge cases: null analysis, empty arrays, missing fields)
2. **Integration smoke test**: `npm run dev` → visit each route → verify no console errors, data renders
3. **Northstar rehearsal**: Walk through the guided demo with live backend data — verify all 6 steps complete
4. **Offline fallback**: Kill the API server → verify mock data loads, toast shows "Using cached data"
5. **Contract tests**: Update `frontend-contract.test.mjs` to assert API client exists and adapters handle all response shapes

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Backend API is slow (50 accounts × analyze = 50 requests) | SWR caching, bulk endpoint (Phase 3), parallel fetch |
| Shape mismatches cause runtime errors | Adapter layer with null-safe defaults, TypeScript strict mode |
| Mock data and live data diverge (different account counts, names) | Adapters handle both; feature flag to switch between mock/live |
| CORS breaks on Vercel re-deploy | Update backend `allow_origins` in `main.py` when Vercel URL changes |
| Auth needed before production | Add JWT/API key middleware to backend, `Authorization` header to frontend API client |
| Guided demo timing breaks with loading states | Pre-fetch all data on demo start, or use mock data for demo mode |

---

## Definition of Done

- [ ] All 9 production routes fetch from live API
- [ ] Mock data works as fallback when API is unreachable
- [ ] Northstar guided demo completes end-to-end with live data
- [ ] No TypeScript errors, no console errors
- [ ] SWR caching prevents redundant fetches
- [ ] Backend gaps filled (interventions list, outcomes list)
- [ ] `npm run build` succeeds for Vercel deploy
- [ ] `npm test` passes (updated contract tests)
