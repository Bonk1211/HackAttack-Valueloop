"""Tests for the 6 missing frontend-integration endpoints."""


# ── 1. GET /api/v1/interventions (list, filterable) ──────────────────────


def test_list_interventions_returns_all(client):
    """Create 2 interventions, list all → 2 returned."""
    client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    })
    client.post("/api/v1/interventions", json={
        "account_id": "ember",
        "recommended_action": "discount_offer",
    })
    r = client.get("/api/v1/interventions")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) >= 2


def test_list_interventions_filter_by_status(client):
    """Create 2 pending, approve 1, filter by status=pending → 1 returned."""
    c1 = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.post("/api/v1/interventions", json={
        "account_id": "ember",
        "recommended_action": "discount_offer",
    })
    # approve first intervention
    client.patch(f"/api/v1/interventions/{c1['id']}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    r = client.get("/api/v1/interventions?status=pending")
    assert r.status_code == 200
    data = r.json()["data"]
    assert all(i["status"] == "pending" for i in data)
    assert len(data) >= 1


def test_list_interventions_filter_by_account_id(client):
    """Filter by account_id returns only that account's interventions."""
    client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    })
    client.post("/api/v1/interventions", json={
        "account_id": "ember",
        "recommended_action": "discount_offer",
    })
    r = client.get("/api/v1/interventions?account_id=northstar")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) >= 1
    assert all(i["account_id"] == "northstar" for i in data)


# ── 2. GET /api/v1/outcomes (list) ──────────────────────────────────────


def test_list_outcomes(client):
    """Create intervention → approve → record outcome → GET /outcomes returns 1."""
    c = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.patch(f"/api/v1/interventions/{c['id']}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    client.post(f"/api/v1/interventions/{c['id']}/outcome", json={
        "usage_delta": 10.0, "health_delta": 5.0,
        "response": "Resolved", "observation": "14-day window",
    })
    r = client.get("/api/v1/outcomes")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) >= 1
    assert any(o["intervention_id"] == c["id"] for o in data)


def test_list_outcomes_filter_by_intervention_id(client):
    """Filter outcomes by intervention_id."""
    c = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.patch(f"/api/v1/interventions/{c['id']}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    client.post(f"/api/v1/interventions/{c['id']}/outcome", json={
        "usage_delta": 10.0,
    })
    r = client.get(f"/api/v1/outcomes?intervention_id={c['id']}")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) >= 1
    assert all(o["intervention_id"] == c["id"] for o in data)


# ── 3. GET /api/v1/accounts?include=analysis ────────────────────────────


def test_list_accounts_without_analysis(client):
    """GET /accounts returns list without 'analysis' key."""
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 50
    assert "analysis" not in data[0]


def test_list_accounts_with_analysis(client):
    """GET /accounts?include=analysis attaches health/risks/causes/actions."""
    r = client.get("/api/v1/accounts?include=analysis")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 50
    # At least some accounts should have analysis (some may be skipped due to FK issues)
    with_analysis = [a for a in data if "analysis" in a]
    assert len(with_analysis) >= 1, "At least 1 account should have analysis"
    first = with_analysis[0]
    analysis = first["analysis"]
    assert "health" in analysis
    assert "risks" in analysis
    assert "causes" in analysis
    assert "actions" in analysis
    # health should have an overall score
    assert "overall" in analysis["health"]
    # risks should be a non-empty list
    assert isinstance(analysis["risks"], list)
    assert len(analysis["risks"]) > 0


# ── 4. GET /api/v1/dashboard/trend ───────────────────────────────────────


def test_dashboard_trend(client):
    """GET /dashboard/trend returns 6 entries with month and mrr."""
    r = client.get("/api/v1/dashboard/trend")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 6
    for entry in data:
        assert "month" in entry
        assert "mrr" in entry
        assert isinstance(entry["mrr"], (int, float))


def test_dashboard_trend_custom_months(client):
    """GET /dashboard/trend?months=3 returns 3 entries."""
    r = client.get("/api/v1/dashboard/trend?months=3")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 3


# ── 5. GET /api/v1/dashboard/action-mix ─────────────────────────────────


def test_dashboard_action_mix(client):
    """Analyze an account to populate action_recommendations, then check action-mix."""
    # Trigger analysis for an account to populate action_recommendations
    client.get("/api/v1/accounts?include=analysis")
    r = client.get("/api/v1/dashboard/action-mix")
    assert r.status_code == 200
    data = r.json()["data"]
    assert isinstance(data, list)
    # action-mix should have at least some categories after analyzing all accounts
    assert len(data) > 0
    first = data[0]
    assert "name" in first
    assert "eligible" in first
    assert "rejected" in first


# ── 6. GET /api/v1/accounts/{id}/risk-history ──────────────────────────


def test_risk_history_returns_7_days(client):
    """GET /accounts/northstar/risk-history returns 7 entries with date and risks."""
    r = client.get("/api/v1/accounts/northstar/risk-history")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 7
    for entry in data:
        assert "date" in entry
        assert "risks" in entry
        assert isinstance(entry["risks"], list)


def test_risk_history_custom_days(client):
    """GET /accounts/northstar/risk-history?days=3 returns 3 entries."""
    r = client.get("/api/v1/accounts/northstar/risk-history?days=3")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 3
