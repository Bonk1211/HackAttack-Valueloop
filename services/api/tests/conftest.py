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

# Per-table (pk column, sentinel value never present) overrides. `outcomes`'
# primary key is `intervention_id` (text), not `id`; `audit_logs.id` is a
# bigserial (bigint), so it needs a numeric sentinel instead of a string one.
# See supabase/migrations/20260719183128_00001_initial_schema.sql.
PK_OVERRIDES = {
    "outcomes": ("intervention_id", "__never__"),
    "audit_logs": ("id", 0),
}


def _wipe(db):
    for table in COMPUTED_TABLES:
        pk, sentinel = PK_OVERRIDES.get(table, ("id", "__never__"))
        db.table(table).delete().neq(pk, sentinel).execute()


@pytest.fixture(autouse=True)
def wipe_computed(db):
    """Clear derived tables between tests so they don't depend on execution order."""
    _wipe(db)
    yield
    _wipe(db)
