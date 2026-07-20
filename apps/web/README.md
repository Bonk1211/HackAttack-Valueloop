# ValueLoop Frontend

ValueLoop's Next.js frontend is connected to the FastAPI `/api/v1` backend for synthetic accounts, analysis, evidence, governed interventions, outcomes, audit logs, risk history, and CSV ingestion. Deterministic fixtures remain available when the API is unreachable. Authentication is not yet implemented.

Use the **Page tutorial** button on any screen for a contextual spotlight walkthrough of the visible controls and evidence panels.

Live deployment: [web-livid-beta-ilnxxzodh3.vercel.app](https://web-livid-beta-ilnxxzodh3.vercel.app)

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Use `npm run build`, `npm test`, `npm run lint`, and `npx tsc --noEmit` for verification.

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` when the API is not running at `http://localhost:8000/api/v1`.

## Routes

- `/` — portfolio overview
- `/guided-demo` — non-technical Detect-to-Measure walkthrough
- `/playbooks` — live analysis-backed no-code playbook preview
- `/risk-queue` — prioritized risk queue
- `/accounts` and `/accounts/northstar` — directory and Customer 360
- `/approvals` — mock approval workflow
- `/outcomes` — observed outcome reporting
- `/audit` — governed event history
- `/data` — synthetic CSV validation and ingestion-job status

Deploy with `vercel --prod` from this directory. Set `apps/web` as the Root Directory if connecting the Git repository in the Vercel dashboard.

The approved interface requirements live in the repository-root `design.md`. Backend integrations and persistence remain out of scope for this mockup.
