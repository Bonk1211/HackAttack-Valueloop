import pytest

@pytest.mark.parametrize("account_id,expected_name", [
    ("northstar", "Northstar Labs"),
    ("ember", "Ember Commerce"),
    ("atlas", "Atlas Robotics"),
])
def test_get_account_returns_name(client, account_id, expected_name):
    r = client.get(f"/api/v1/accounts/{account_id}")
    assert r.status_code == 200
    assert r.json()["data"]["account"]["name"] == expected_name

def test_list_accounts_returns_50(client):
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200
    assert len(r.json()["data"]) == 50

def test_get_account_not_found_returns_404(client):
    r = client.get("/api/v1/accounts/nonexistent")
    assert r.status_code == 404
    body = r.json()
    assert body["errors"][0]["code"] == 404

def test_account_has_freshness(client):
    r = client.get("/api/v1/accounts/northstar")
    assert r.status_code == 200
    freshness = r.json()["data"]["freshness"]
    assert "product_usage" in freshness
    assert freshness["product_usage"] != "no data"

def test_account_has_data_quality_score(client):
    r = client.get("/api/v1/accounts/northstar")
    assert r.status_code == 200
    assert 0 <= r.json()["data"]["data_quality"] <= 100

def test_timeline_sorted_desc(client):
    r = client.get("/api/v1/accounts/northstar/timeline")
    assert r.status_code == 200
    events = r.json()["data"]
    ts = [e["timestamp"] for e in events]
    assert ts == sorted(ts, reverse=True)
    assert any(e["kind"] == "usage" for e in events)
    assert any(e["kind"] == "support" for e in events)

def test_timeline_404_for_missing_account(client):
    r = client.get("/api/v1/accounts/nonexistent/timeline")
    assert r.status_code == 404
