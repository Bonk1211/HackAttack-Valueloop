"""End-to-end tests for the complete customer success loop."""


def test_northstar_full_loop(client):
    """Detect → Explain → Decide → Approve → Act → Measure."""
    r = client.get("/api/v1/accounts")
    ids = [a["id"] for a in r.json()["data"]]
    assert "northstar" in ids

    r = client.get("/api/v1/accounts/northstar")
    assert r.status_code == 200
    profile = r.json()["data"]
    assert profile["account"]["id"] == "northstar"

    r = client.post("/api/v1/accounts/northstar/analyze")
    assert r.status_code == 200
    analysis = r.json()["data"]
    assert analysis["health"]["experience"] < 40
    canc = next(x for x in analysis["risks"] if x["risk_type"] == "cancellation")
    assert canc["probability"] >= 0.75
    assert analysis["causes"][0]["cause"] == "technical_support"

    actions_by_code = {a["action_code"]: a for a in analysis["actions"]}
    assert actions_by_code["payment_retry"]["eligibility"] is False
    assert actions_by_code["upgrade_review"]["eligibility"] is False
    assert actions_by_code["support_escalation"]["eligibility"] is True

    r = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    })
    iid = r.json()["data"]["id"]
    client.patch(f"/api/v1/interventions/{iid}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })

    r = client.patch(f"/api/v1/interventions/{iid}", json={
        "status": "executed", "actor_id": "aisha", "actor_role": "csm",
        "final_action": "support_escalation",
    })
    assert r.json()["data"]["status"] == "executed"

    r = client.post(f"/api/v1/interventions/{iid}/outcome", json={
        "usage_delta": 18.0, "health_delta": 12.0,
        "response": "Incident resolved",
        "observation": "Observed over 14 days; no causal claim",
    })
    assert r.status_code == 200
    assert r.json()["data"]["usage_delta"] == 18.0

    r = client.get(f"/api/v1/audit?entity_type=intervention&entity_id={iid}")
    logs = r.json()["data"]
    actions_logged = [log["action"] for log in logs]
    assert "create_intervention" in actions_logged
    assert "intervention_approved" in actions_logged
    assert "intervention_executed" in actions_logged


def test_dashboard_kpis_reflect_seeded_state(client):
    r = client.get("/api/v1/dashboard/kpis")
    assert r.status_code == 200
    kpis = r.json()["data"]
    assert kpis["total_accounts"] == 50
    assert kpis["at_risk_mrr"] > 0


def test_audit_query_filters_by_entity(client):
    r = client.get("/api/v1/audit?entity_type=intervention&limit=5")
    assert r.status_code == 200
    for log in r.json()["data"]:
        assert log["entity_type"] == "intervention"
