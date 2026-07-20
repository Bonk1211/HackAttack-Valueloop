import pytest


def test_risks_northstar_cancellation_high(client):
    r = client.get("/api/v1/accounts/northstar/risks")
    body = r.json()
    canc = next(x for x in body["data"] if x["risk_type"] == "cancellation")
    assert canc["probability"] >= 0.75
    assert canc["model_version"] == "1.0"

def test_risks_ember_payment_failure(client):
    r = client.get("/api/v1/accounts/ember/risks")
    body = r.json()
    pay = next(x for x in body["data"] if x["risk_type"] == "payment_failure")
    assert pay["probability"] >= 0.70

def test_risks_atlas_expansion_ready(client):
    r = client.get("/api/v1/accounts/atlas/risks")
    body = r.json()
    exp = next(x for x in body["data"] if x["risk_type"] == "expansion_readiness")
    assert exp["probability"] >= 0.70

def test_risks_returns_all_five_types(client):
    r = client.get("/api/v1/accounts/northstar/risks")
    types = {x["risk_type"] for x in r.json()["data"]}
    assert types == {"cancellation","downgrade","inactivity","payment_failure","expansion_readiness"}


# --- Phase C: unit test for probability/confidence clamping ---------------

def test_risk_probability_and_confidence_clamped():
    from app.modules.risk import _risk
    low = _risk("cancellation", -5.0, -5.0)
    high = _risk("cancellation", 5.0, 5.0)
    assert low.probability == 0.0
    assert low.confidence == 0.0
    assert high.probability == 1.0
    assert high.confidence == 1.0
