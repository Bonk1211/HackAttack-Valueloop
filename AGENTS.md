# Repository Guidelines

## Codex Context and Source of Truth

Before implementation, read `context.md` and the relevant section of `ValueLoop_Master_Implementation_Blueprint_FULL.md`. The blueprint is authoritative for product behavior, architecture, APIs, acceptance criteria, and ethical constraints; `context.md` tracks the current plan and unresolved decisions. Keep both synchronized when scope changes. For frontend work, follow the approved `design.md` and preserve its mockup-only boundary.

## Project Structure & Module Organization

The repository is specification-first. Planned code belongs in `apps/web/` (Next.js), `services/api/` (FastAPI), `packages/` (shared UI/types), `ml/`, `policies/`, `data/seeds/`, `scripts/`, and `tests/`. Put decisions and supporting notes in `docs/`. Reusable Codex playbooks live in `.agents/skills/`; custom definitions, durable notes, and local plugin material belong in the other `.agents/` subdirectories.

## Build, Test, and Development Commands

Run frontend commands from `apps/web/`: `npm ci`, `npm run dev`, `npm run build`, `npm test`, and `npm run lint`. The current app is a fixture-driven mockup; do not add backend calls, persistence, or authentication unless explicitly requested. Document new operational commands in `README.md` as soon as they work.

## Coding Style & Naming Conventions

Use 2 spaces for TypeScript, JSON, and YAML; use 4 spaces and PEP 8 for Python. Use `PascalCase` for React components, `camelCase` for TypeScript functions, and `snake_case` for Python. Keep API contracts typed, configuration centralized, database changes migration-based, and decision rules in versioned YAML/JSON or Python—not UI code.

## Product Guardrails and Testing

Models and LLMs only advise; deterministic policy and human approval control actions. Never claim verified causes or causal uplift from synthetic data. Test health bounds, `Unknown` outcomes, policy rejection, frequency caps, approval gates, template fallback, and audit creation. The Northstar Labs E2E test must cover Detect → Explain → Decide → Approve → Act → Measure.

## Commit & Pull Request Guidelines

Use short imperative commits, preferably `feat:`, `fix:`, `test:`, or `docs:`. Pull requests must reference the blueprint section or issue, list verification, and identify schema, policy, model, seed, or environment changes. Add screenshots after the design system exists. Never commit secrets, real customer data, generated caches, or notebook outputs containing sensitive data.
