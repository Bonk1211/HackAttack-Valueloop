import pytest
from app.modules.health import _adoption_score, _experience_score, _financial_score, _value_score

def test_health_northstar_experience_low(client):
    r = client.get("/api/v1/accounts/northstar/health")
    assert r.status_code == 200
    h = r.json()["data"]
    assert 0 <= h["experience"] <= 40  # 2 critical tickets → ~29
    assert h["financial"] >= 80        # payments current
    assert all(0 <= h[dim] <= 100 for dim in ["adoption","engagement","experience","financial","value"])

def test_health_ember_financial_low(client):
    r = client.get("/api/v1/accounts/ember/health")
    h = r.json()["data"]
    assert h["financial"] < 40  # 2 failed payment attempts
    assert h["adoption"] > 60   # usage stable

def test_health_stored_with_version(client):
    r = client.get("/api/v1/accounts/northstar/health")
    h = r.json()["data"]
    assert h["version"] == "1.0"

def test_health_overall_is_weighted_sum(client):
    r = client.get("/api/v1/accounts/atlas/health")
    h = r.json()["data"]
    expected = (
        h["adoption"] * 0.25 + h["engagement"] * 0.20 + h["experience"] * 0.20
        + h["financial"] * 0.20 + h["value"] * 0.15
    )
    assert abs(h["overall"] - round(expected, 1)) < 0.2


# --- Phase C: unit tests for uncovered default/branch cases ---------------

def test_adoption_score_empty_usage_defaults_to_50():
    assert _adoption_score([]) == 50.0

def test_adoption_score_no_core_workflow_defaults_to_40():
    usage = [{"feature": "dashboard", "timestamp": "2026-07-19T00:00:00+00:00"}]
    assert _adoption_score(usage) == 40.0

def test_experience_score_medium_and_low_open_tickets():
    tickets = [
        {"severity": "medium", "closed_at": None},
        {"severity": "low", "closed_at": None},
    ]
    assert _experience_score(tickets) == 100.0 - 12 - 5

def test_financial_score_no_payments_defaults_to_80():
    assert _financial_score([]) == 80.0

def test_value_score_no_feedback_defaults_to_60():
    assert _value_score([]) == 60.0

def test_value_score_no_csat_defaults_to_60():
    feedback = [{"metric_type": "nps", "score": 9}]
    assert _value_score(feedback) == 60.0
