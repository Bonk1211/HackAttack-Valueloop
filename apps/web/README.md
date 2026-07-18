# ValueLoop Frontend

Production-ready frontend mockup for the ValueLoop customer-value intelligence dashboard. All accounts, risks, evidence, approvals, and outcomes use deterministic local fixtures; no backend or authentication is required.

Live deployment: [web-livid-beta-ilnxxzodh3.vercel.app](https://web-livid-beta-ilnxxzodh3.vercel.app)

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Use `npm run build`, `npm test`, `npm run lint`, and `npx tsc --noEmit` for verification.

## Routes

- `/` — portfolio overview
- `/risk-queue` — prioritized risk queue
- `/accounts` and `/accounts/northstar` — directory and Customer 360
- `/approvals` — mock approval workflow
- `/outcomes` — observed outcome reporting
- `/audit` — governed event history

Deploy with `vercel --prod` from this directory. Set `apps/web` as the Root Directory if connecting the Git repository in the Vercel dashboard.

The approved interface requirements live in the repository-root `design.md`. Backend integrations and persistence remain out of scope for this mockup.
