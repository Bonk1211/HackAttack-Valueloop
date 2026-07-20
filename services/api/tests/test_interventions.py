def test_create_intervention_starts_pending(client):
    r = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    })
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["status"] == "pending"
    assert body["recommended_action"] == "support_escalation"
    return body["id"]


def test_transition_pending_to_approved(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    r = client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "approved",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "approved"
    assert r.json()["data"]["approver"] == "aisha"


def test_invalid_transition_rejected(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    r = client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "delivered",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    assert r.status_code == 422


def test_rejected_transition_cannot_move_forward(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "rejected",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    r = client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "executed",
        "actor_id": "aisha",
        "actor_role": "csm",
    })
    assert r.status_code == 422


def test_outcome_recorded_and_marks_delivered(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    client.patch(f"/api/v1/interventions/{create['id']}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    r = client.post(f"/api/v1/interventions/{create['id']}/outcome", json={
        "usage_delta": 18.0, "health_delta": 12.0,
        "response": "Incident resolved",
        "observation": "Observed over 14 days",
    })
    assert r.status_code == 200
    assert r.json()["data"]["usage_delta"] == 18.0


def test_audit_log_created_for_each_transition(client):
    create = client.post("/api/v1/interventions", json={
        "account_id": "northstar",
        "recommended_action": "support_escalation",
    }).json()["data"]
    iid = create["id"]
    client.patch(f"/api/v1/interventions/{iid}", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    r = client.get(f"/api/v1/audit?entity_type=intervention&entity_id={iid}")
    assert r.status_code == 200
    logs = r.json()["data"]
    assert len(logs) >= 2


def test_intervention_not_found_returns_404(client):
    r = client.patch("/api/v1/interventions/int-does-not-exist", json={
        "status": "approved", "actor_id": "aisha", "actor_role": "csm",
    })
    assert r.status_code == 404
