# ValueLoop API

FastAPI backend for the ValueLoop SaaS platform.

## Setup

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Fill in SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY
```

## Run

```bash
uvicorn app.main:app --reload
```

## Health check

```bash
curl http://127.0.0.1:8000/healthz
```
