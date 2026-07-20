import subprocess
import sys
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Unit and contract tests must collect without a developer .env or CI secrets.
# setdefault preserves real credentials when the opt-in integration suite runs.
os.environ.setdefault("SUPABASE_URL", "https://test.invalid")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

SEED_SCRIPT = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "seed_demo.py"
COMPUTED_TABLES = [
    "outcomes", "audit_logs", "action_recommendations",
    "cause_hypotheses", "risk_predictions", "health_scores",
]

RUN_INTEGRATION = os.getenv("RUN_INTEGRATION_TESTS") == "1"


def pytest_collection_modifyitems(config, items):
    """Keep local tests hermetic; live Supabase tests are an explicit release gate."""
    skip_live = pytest.mark.skip(reason="set RUN_INTEGRATION_TESTS=1 to run live Supabase integration tests")
    for item in items:
        if {"client", "db"}.intersection(item.fixturenames):
            item.add_marker("integration")
            if not RUN_INTEGRATION:
                item.add_marker(skip_live)


@pytest.fixture(scope="session")
def seed_db_once():
    """Run the deterministic seed once per pytest session."""
    result = subprocess.run([sys.executable, str(SEED_SCRIPT)], capture_output=True, text=True)
    assert result.returncode == 0, f"seed_demo.py failed: {result.stderr}"
    yield

@pytest.fixture(scope="session")
def db(seed_db_once):
    """Session-scoped Supabase client seeded with 50 accounts."""
    from app.core.db import get_supabase
    return get_supabase()

@pytest.fixture(scope="session")
def client(seed_db_once):
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
def wipe_computed(request):
    """Clear derived tables between tests so they don't depend on execution order."""
    if not {"client", "db"}.intersection(request.fixturenames):
        yield
        return
    db = request.getfixturevalue("db")
    _wipe(db)
    yield
    _wipe(db)
