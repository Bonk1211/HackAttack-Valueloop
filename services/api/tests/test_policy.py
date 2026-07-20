def test_payment_action_rejected_without_evidence(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    pay = next(x for x in r.json()["data"] if x["action_code"] == "payment_retry")
    assert pay["eligibility"] is False
    assert "payment" in pay["rejection_reason"].lower()

def test_upgrade_rejected_when_experience_low(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    upg = next(x for x in r.json()["data"] if x["action_code"] == "upgrade_review")
    assert upg["eligibility"] is False
    assert "experience" in upg["rejection_reason"].lower()

def test_support_escalation_eligible_for_northstar(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    esc = next(x for x in r.json()["data"] if x["action_code"] == "support_escalation")
    assert esc["eligibility"] is True

def test_payment_action_eligible_for_ember(client):
    r = client.get("/api/v1/accounts/ember/actions")
    pay = next(x for x in r.json()["data"] if x["action_code"] == "payment_retry")
    assert pay["eligibility"] is True

def test_sensitive_action_requires_approval(client):
    r = client.get("/api/v1/accounts/lumen/actions")
    plan = next(x for x in r.json()["data"] if x["action_code"] == "plan_review")
    if plan["eligibility"]:
        assert plan["approval_required"] is True

def test_no_action_always_eligible(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    no_act = next(x for x in r.json()["data"] if x["action_code"] == "no_action")
    assert no_act["eligibility"] is True

def test_frequency_cap_field_present(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    for a in r.json()["data"]:
        assert "benefit" in a and "friction" in a and "risk" in a

def test_eligible_actions_have_utility_score(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    for a in r.json()["data"]:
        if a["eligibility"]:
            assert a["utility_score"] is not None
            assert isinstance(a["utility_score"], (int, float))

def test_rejected_actions_have_reason(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    for a in r.json()["data"]:
        if not a["eligibility"]:
            assert a["rejection_reason"] is not None and len(a["rejection_reason"]) > 0

def test_actions_list_includes_all_eight_codes(client):
    r = client.get("/api/v1/accounts/northstar/actions")
    codes = {a["action_code"] for a in r.json()["data"]}
    assert codes == {
        "in_app_education","payment_retry","support_escalation",
        "human_outreach","plan_review","pause_subscription",
        "upgrade_review","no_action",
    }
