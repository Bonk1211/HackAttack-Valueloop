def _risks(client, acc):
    body = client.get(f"/api/v1/accounts/{acc}/risks").json()
    return {x["risk_type"]: x for x in body["data"]}


def _rank(risks):
    """Risk types ordered by probability, highest first."""
    return [k for k, _ in sorted(risks.items(), key=lambda kv: kv[1]["probability"], reverse=True)]


# The risk service is now a trained model (LR/XGBoost) with a deterministic
# rules fallback. We no longer assert the rules-era absolute thresholds (the
# model, trained on synthetic data, scores accounts differently and honestly);
# instead we assert it RANKS each demo account's risks correctly — behavior
# that holds under both the model and the fallback.

def test_risks_northstar_cancellation_elevated(client):
    r = _risks(client, "northstar")
    # Northstar carries unresolved high/critical tickets — cancellation is among
    # its top risks, and provenance is a real model version, not the "1.0" stub.
    assert "cancellation" in _rank(r)[:2]
    assert r["cancellation"]["model_version"] != "1.0"


def test_risks_ember_payment_is_top_risk(client):
    r = _risks(client, "ember")
    # Ember has repeated failed payments — payment_failure is a leading risk.
    assert "payment_failure" in _rank(r)[:2]


def test_risks_atlas_expansion_is_top_risk(client):
    r = _risks(client, "atlas")
    # Atlas is healthy with strong usage and feedback — expansion readiness leads.
    assert _rank(r)[0] == "expansion_readiness"


def test_risks_returns_all_five_types(client):
    r = client.get("/api/v1/accounts/northstar/risks")
    types = {x["risk_type"] for x in r.json()["data"]}
    assert types == {"cancellation", "downgrade", "inactivity", "payment_failure", "expansion_readiness"}


# --- unit test for probability/confidence clamping -------------------------

def test_risk_probability_and_confidence_clamped():
    from app.modules.risk import _risk
    low = _risk("cancellation", -5.0, -5.0)
    high = _risk("cancellation", 5.0, 5.0)
    assert low.probability == 0.0
    assert low.confidence == 0.0
    assert high.probability == 1.0
    assert high.confidence == 1.0
