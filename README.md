# ValueLoop

ValueLoop is an explainable subscription-value intelligence and next-best-action platform for B2B SaaS customer-success teams. It combines product usage, billing, support, feedback, contracts, and customer goals into a Customer 360 view, detects value loss, explains likely causes, recommends policy-safe actions, and records outcomes.

> **Product thesis:** Do not merely predict churn. Detect value loss, explain the likely cause, recommend the safest next-best action, and learn from the outcome.

## Project Status

The full frontend is implemented in `apps/web/` using deterministic local fixtures and deployed on Vercel. It covers Value, Experience, Product-fit, Price, Involuntary, Competitive, Lifecycle, and Silent churn from risk evidence through governed action and outcome. Backend services, persistence, authentication, and production intelligence remain planned work.

**Live frontend:** [web-livid-beta-ilnxxzodh3.vercel.app](https://web-livid-beta-ilnxxzodh3.vercel.app)

The prototype is for Hack Attack 3.0, Case Study 2. It will use synthetic data for 50 accounts and demonstrate mechanisms and workflows—not production predictive accuracy, verified causality, or autonomous customer actions.

## Core Demo Flow

The Northstar Labs scenario exercises the complete governed loop:

**Detect → Explain → Decide → Approve → Act → Measure**

1. Rank accounts by risk, urgency, and at-risk MRR.
2. Show five health dimensions: Adoption, Engagement, Experience, Financial, and Value.
3. Present separate risk outputs and evidence-backed cause hypotheses.
4. Reject ineligible actions through deterministic policy rules.
5. Route sensitive actions for human approval.
6. Log the intervention, audit trail, and observed outcome.

Models and optional LLMs may advise, but policies, permissions, and humans control execution. Template explanations must work when an LLM is unavailable.

## Planned Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web | Next.js, TypeScript, Tailwind CSS, Recharts | Dashboard, Customer 360, approvals, outcomes |
| API | FastAPI, typed schemas | Ingestion, analysis, decisioning, interventions |
| Data | Supabase PostgreSQL, Auth, Storage | Customer data, roles, uploads, audit history |
| Intelligence | pandas, scikit-learn/XGBoost, SHAP | Features, risk, confidence, evidence |
| Control plane | Python and versioned YAML/JSON | Cause rules, eligibility, safety, frequency caps |
| Deployment | Vercel, Render/Railway, Supabase | Hackathon-ready managed hosting |

The backend is a modular monolith with boundaries for ingestion, Customer 360, features, health, risk, causes, policy, actions, explanations, interventions, outcomes, and audit.

## Planned Repository Layout

```text
apps/web/                  Next.js frontend
services/api/              FastAPI backend
packages/ui/               Shared UI components
packages/shared-types/     Cross-service contracts
ml/models/                 Versioned model artifacts
ml/notebooks/              Exploration only
policies/                  Action and cause rules
data/seeds/                Synthetic demo data
scripts/seed_demo.py       Deterministic seed/reset entry point
tests/                     Integration, policy, API, and E2E tests
docs/                      Supporting architecture and decisions
```

## Getting Started

The frontend uses Node.js 24:

```bash
cd apps/web
npm ci
npm run dev
```

Use `npm run build` for a production build, `npm test` for route and fixture contracts, and `npm run lint` for static analysis. The mockup uses local fixtures and requires no environment variables or backend service.

Production routes are `/`, `/risk-queue`, `/accounts`, `/accounts/{id}`, `/approvals`, `/outcomes`, and `/audit`. Example account IDs include `northstar`, `harborline`, `forgeworks`, `lumen`, `ember`, `cobalt`, `meridian`, and `willow`. Deploy from `apps/web/` with `vercel --prod` after signing in to the Vercel CLI.

For current work, read these documents in order:

1. [`AGENTS.md`](AGENTS.md) — contributor and Codex operating rules.
2. [`context.md`](context.md) — concise implementation context and phased plan.
3. [`design.md`](design.md) — approved frontend design specification.
4. [`ValueLoop_Master_Implementation_Blueprint_FULL.md`](ValueLoop_Master_Implementation_Blueprint_FULL.md) — detailed source of truth.

## Delivery Roadmap

1. **Initialize:** monorepo, configuration, migrations, linting, CI, local startup.
2. **Data foundation:** schema, deterministic seeds, CSV validation, Customer 360.
3. **Intelligence:** health scores, risk, evidence, cause hypotheses.
4. **Decisioning:** action registry, safety policies, approvals, audit events.
5. **Product UI:** implement supplied design across the core screens.
6. **Hardening and demo:** auth, fallbacks, automated tests, rehearsal, backup.

## Safety and Honesty

- Use only synthetic demo data; never commit credentials or real customer data.
- Describe causes as hypotheses and support conflicting evidence or `Unknown`.
- Do not recommend payment recovery without payment evidence.
- Do not recommend upgrades when customer experience is poor.
- Preserve transparent downgrade, pause, cancellation, and no-action choices.
- Store rule/model versions and timestamps for every prediction and decision.
