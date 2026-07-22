# ValueLoop — unified dev environment
# Usage: make install && make run

.PHONY: install install-be install-fe run run-be run-fe test test-be test-be-live test-fe test-fe-e2e test-release seed clean help

# ─── Install ───────────────────────────────────────────────────────────

install: install-be install-fe ## Install all dependencies (BE + FE)

install-be: ## Install backend deps with uv
	@echo "🐍 Installing backend dependencies..."
	cd services/api && uv venv .venv && uv pip install -e ".[dev]"
	@echo "✅ Backend ready (services/api/.venv)"

install-fe: ## Install frontend deps with npm
	@echo "📦 Installing frontend dependencies..."
	cd apps/web && npm ci
	@echo "✅ Frontend ready (apps/web/node_modules)"

# ─── Run ───────────────────────────────────────────────────────────────

run: ## Run BE + FE together (Ctrl+C to stop both)
	@echo "🚀 Starting backend (port 8000) + frontend (port 3000)..."
	@$(MAKE) -j2 run-be run-fe

run-be: ## Run backend only (uvicorn on port 8000)
	cd services/api && .venv/bin/uvicorn app.main:app --reload --port 8000

run-fe: ## Run frontend only (next dev on port 3000)
	cd apps/web && npm run dev

# ─── Test ──────────────────────────────────────────────────────────────

test: test-be test-fe ## Run all tests

test-be: ## Run hermetic backend tests with coverage
	cd services/api && python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=65

test-be-live: ## Reset and test a disposable live Supabase project
	cd services/api && RUN_INTEGRATION_TESTS=1 python -m pytest -m integration --cov=app --cov-report=term-missing --cov-fail-under=70

test-fe: ## Run frontend contract and coverage tests
	cd apps/web && npm run test:contract && npm run test:coverage

test-fe-e2e: ## Run production-build Playwright tests
	cd apps/web && npm run test:e2e

test-release: test test-fe-e2e ## Run all hermetic release gates

# ─── ML ────────────────────────────────────────────────────────────────

train-ml: ## Train risk models (LR + XGBoost) into ml/models/
	services/api/.venv/bin/python -m ml.train

# ─── Seed ──────────────────────────────────────────────────────────────

seed: ## Seed demo data (50 accounts) into Supabase
	cd services/api && .venv/bin/python ../../scripts/seed_demo.py

# ─── Clean ─────────────────────────────────────────────────────────────

clean: ## Remove venv, node_modules, build artifacts
	rm -rf services/api/.venv
	rm -rf apps/web/node_modules apps/web/.next
	rm -rf .coverage services/api/.coverage
	@echo "🧹 Cleaned"

# ─── Help ──────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
