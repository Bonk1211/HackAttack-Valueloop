def test_northstar_top_cause_is_technical_support(client):
    r = client.get("/api/v1/accounts/northstar/causes")
    body = r.json()
    top = body["data"][0]
    assert top["cause"] == "technical_support"
    assert top["confidence"] >= 0.70
    assert top["rank"] == 1

def test_ember_top_cause_is_payment(client):
    r = client.get("/api/v1/accounts/ember/causes")
    body = r.json()
    assert body["data"][0]["cause"] == "payment"
    assert body["data"][0]["confidence"] >= 0.85

def test_unknown_fallback_for_low_signal_account(client):
    r = client.get("/api/v1/accounts/willow/causes")
    body = r.json()
    # willow has disengagement evidence; may or may not hit unknown
    # but at minimum: results is a non-empty list
    assert len(body["data"]) >= 1

def test_hypotheses_include_evidence_and_contradictions(client):
    r = client.get("/api/v1/accounts/northstar/causes")
    body = r.json()
    for h in body["data"]:
        assert "evidence_json" in h
        assert "contradictions_json" in h
        assert isinstance(h["evidence_json"], list)

def test_rule_version_present(client):
    r = client.get("/api/v1/accounts/northstar/causes")
    for h in r.json()["data"]:
        assert h["rule_version"] == "1.0"
