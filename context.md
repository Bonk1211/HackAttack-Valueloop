# ValueLoop Implementation Context

## Purpose

This file is the durable, concise execution context for Codex. It translates the master blueprint into an implementation sequence without replacing it. When requirements conflict, follow the latest user instruction, then `AGENTS.md`, then the master blueprint. Update this file when a decision is resolved or a phase changes state.

## Product Objective

Build a hackathon-ready modular monolith that helps a B2B SaaS Customer Success Manager detect value loss, understand evidence-backed cause hypotheses, choose a safe next-best action, obtain required approval, and measure the observed outcome.

The prototype uses 50 synthetic accounts. Northstar Labs is the primary seeded scenario: cancellation risk is driven by falling usage and unresolved severe tickets while payments remain healthy. The system should recommend support escalation, reject payment recovery and upgrade actions, and show a later improvement in usage and health.

## Non-Negotiable Principles

- Keep probabilistic intelligence inside a deterministic control plane.
- Models and an optional LLM may advise but cannot bypass policy, permissions, or approval.
- Generate explanations from structured evidence; templates are the default fallback.
- Call causes *hypotheses*, show contradictions, and support `Unknown`.
- Do not claim causal uplift or production accuracy from synthetic data.
- Keep downgrade, pause, cancellation, and no-action paths transparent.
- Version and timestamp scores, predictions, rules, recommendations, and state changes.
- Audit every recommendation, override, approval, execution, and outcome.

## MVP Vertical Slice

The first complete slice must support:

1. deterministic seed/reset of 50 accounts;
2. a risk-sorted dashboard and Customer 360 account page;
3. five health dimensions with evidence and freshness;
4. separate cancellation, downgrade, inactivity, payment-failure, and expansion-readiness risks;
5. all eight reviewed churn pathways, with ranked cause hypotheses and supporting and contradictory evidence;
6. a fixed action registry filtered by eligibility, safety, consent, and frequency;
7. approval, modification, rejection, simulated execution, and outcome capture;
8. an immutable audit trail and template-only explanation mode.

## Technical Direction

- **Frontend:** Next.js, TypeScript, Tailwind CSS, and Recharts.
- **Backend:** FastAPI modular monolith with typed request/response schemas.
- **Platform:** Supabase PostgreSQL, Auth, and Storage.
- **Data/ML:** pandas, transparent logistic-regression baseline, optional XGBoost only if validation improves, and SHAP/direct evidence.
- **Rules:** versioned Python plus YAML/JSON policies.
- **Deployment:** Vercel for web; Render or Railway for API; Supabase for platform services.

Backend module seams are `ingestion`, `customer360`, `features`, `health`, `risk`, `causes`, `policy`, `actions`, `explanations`, `interventions`, `outcomes`, and `audit`. Policy eligibility always overrides utility ranking.

## Implementation Plan

### Phase 0 — Repository Initialization

Create the monorepo, pinned dependencies, environment example, lint/format rules, CI, database migration workflow, Docker/local orchestration if useful, and documented commands. Exit when web and API start locally and a fresh clone can be configured without guesswork.

### Phase 1 — Data Foundation

Define core tables and typed domain contracts. Build deterministic synthetic seeds, CSV schema validation, deduplication, quarantine/error reporting, freshness tracking, and Customer 360 timeline assembly. Exit when 50 accounts load and the Northstar profile is reproducible.

### Phase 2 — Health and Intelligence

Implement point-in-time features, five versioned health scores, transparent risk fallbacks, separate risk outputs, confidence, contributors, and rule-based cause hypotheses. Exit when Northstar produces the expected evidence and ambiguous accounts produce multiple hypotheses or `Unknown`.

### Phase 3 — Governed Decisioning

Create the 5–8 action registry, eligibility/safety rules, frequency caps, utility scoring, explanations, approval state machine, intervention records, outcomes, and audit events. Exit when ineligible actions are explainably rejected and sensitive actions cannot execute without approval.

### Phase 4 — Product UI Mockup (Implemented and Deployed)

The approved `design.md` is implemented as a local-fixture-only Next.js frontend in `apps/web/`. It includes real routes for the overview, risk queue, accounts, Customer 360, approvals, outcomes, and audit screens, plus responsive navigation, mock interactions, accessible focus states, and a custom 404. Eight deterministic profiles cover Value, Experience, Product-fit, Price, Involuntary, Competitive, Lifecycle, and Silent churn from evidence through governed action, outcome, and audit; account routes load the selected fixture. The Risk Queue defaults to an interactive account → pathway → leading-issue map with a table alternative. The stakeholder-reviewed visual language uses regular-weight warm-neutral typography, bracketed monograms, a movie-ticket-inspired selected-account risk pass, and a light evidence-file treatment for cause hypotheses. Motion is limited to spring-based shell and section entrances, transform/opacity state changes, and tactile control feedback; reduced-motion users receive immediate state changes. The production frontend is deployed at `https://web-livid-beta-ilnxxzodh3.vercel.app`. Backend integration, persistence, authentication, and production intelligence are deliberately excluded.

### Phase 5 — Hardening and Demo

Add Supabase authentication and role checks, safe errors, structured logs, caching/fallbacks, unit/integration/policy/API/E2E coverage, performance checks, deterministic demo reset, and the five-minute rehearsal. Exit when the full Northstar loop works without an external LLM and no critical browser or API errors occur.

## Decisions Pending

- Logistic regression only versus adding XGBoost.
- Final health weights, confidence thresholds, and business-cost matrix.
- Exact demo action registry and CSM-versus-manager approval boundaries.
- Whether cancellation simulation fits the final scope.
- Template-only explanations versus a named optional LLM provider.
- Offline/local fallback beyond the fixture-driven development server.
- Any visual revisions discovered during stakeholder review of the frontend mockup.

Do not silently resolve these decisions in foundational code. Prefer interfaces and configuration that keep the choice reversible, and record the decision in `docs/` when confirmed.
