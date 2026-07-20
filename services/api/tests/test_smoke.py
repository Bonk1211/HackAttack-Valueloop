def test_conftest_fixtures_exist(db, client):
    assert db is not None
    assert client is not None


def test_fifty_accounts_seeded(db):
    rows = db.table("accounts").select("id").execute().data
    assert len(rows) == 50


def test_northstar_exists(db):
    row = db.table("accounts").select("id,name").eq("id", "northstar").maybe_single().execute()
    assert row.data["name"] == "Northstar Labs"


def test_computed_tables_empty_after_wipe(db):
    for table in ["health_scores", "risk_predictions", "cause_hypotheses", "action_recommendations"]:
        assert db.table(table).select("id").execute().data == []
