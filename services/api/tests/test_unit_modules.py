from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.errors import ValidationError
from app.models import HealthScore, RiskPrediction
from app.models.envelope import envelope
from app.modules.actions import _utility
from app.modules.causes import _evaluate, _export_spike
from app.modules.customer360 import compute_freshness, score_data_quality
from app.modules.health import (
    _adoption_score,
    _engagement_score,
    _experience_score,
    _financial_score,
    _value_score,
)
from app.modules.ingestion import insert_valid, parse_csv, validate_row
from app.modules.policy import _base_eligibility, _max_window, load_actions
from app.modules.risk import _risk


def _context(**overrides):
    baseline = {
        "open_critical_tickets": 0,
        "open_high_tickets": 0,
        "payment_failure_evidence": False,
        "contact_allowed": True,
        "plan_utilization_low": False,
        "price_objection": False,
        "lifecycle_evidence": False,
        "expansion_readiness_high": False,
        "experience_score": 100,
    }
    return {**baseline, **overrides}


@pytest.mark.parametrize(
    ("code", "overrides", "eligible", "reason"),
    [
        ("in_app_education", {}, True, None),
        ("in_app_education", {"open_critical_tickets": 1}, False, "Severe open ticket"),
        ("payment_retry", {}, False, "No payment-failure"),
        ("payment_retry", {"payment_failure_evidence": True}, True, None),
        ("support_escalation", {}, False, "No severe issue"),
        ("support_escalation", {"open_high_tickets": 2}, True, None),
        ("human_outreach", {"contact_allowed": False}, False, "Contact not allowed"),
        ("human_outreach", {}, True, None),
        ("plan_review", {}, False, "No plan/price"),
        ("plan_review", {"price_objection": True}, True, None),
        ("pause_subscription", {}, False, "No lifecycle"),
        ("pause_subscription", {"lifecycle_evidence": True}, True, None),
        ("upgrade_review", {"experience_score": 60, "expansion_readiness_high": True}, False, "below 70"),
        ("upgrade_review", {}, False, "Expansion readiness"),
        ("upgrade_review", {"expansion_readiness_high": True}, True, None),
        ("no_action", {}, True, None),
        ("not_registered", {}, False, "Unknown action"),
    ],
)
def test_every_policy_gate(code, overrides, eligible, reason):
    result, rejection = _base_eligibility(code, _context(**overrides))
    assert result is eligible
    if reason:
        assert reason in rejection
    else:
        assert rejection is None


def test_registry_is_versioned_fixed_and_frequency_limited():
    actions = load_actions()
    assert {action["code"] for action in actions} == {
        "in_app_education", "payment_retry", "support_escalation", "human_outreach",
        "plan_review", "pause_subscription", "upgrade_review", "no_action",
    }
    assert all(_max_window(action) is not None for action in actions)
    assert _max_window({"code": "example"}) is None


@pytest.mark.parametrize(
    ("benefit", "friction", "risk", "expected"),
    [("high", "low", "low", 0.81), ("medium", "medium", "medium", 0.33), ("unknown", "unknown", "unknown", 0.12)],
)
def test_utility_is_deterministic(benefit, friction, risk, expected):
    assert _utility(benefit, friction, risk) == expected


def test_health_scoring_boundaries_and_defaults():
    now = datetime.now(timezone.utc)
    recent = now.isoformat()
    old = (now - timedelta(days=31)).isoformat()
    assert _adoption_score([]) == 50
    assert _adoption_score([{"feature": "secondary", "timestamp": recent}]) == 40
    assert _adoption_score([{"feature": "core_workflow", "timestamp": old}]) == 20
    assert _adoption_score([{"feature": "core_workflow", "timestamp": recent}] * 30) == 100
    assert _engagement_score([]) == 50
    assert _engagement_score([{"timestamp": recent}] * 5) == pytest.approx(100 / 30)
    assert _experience_score([{"severity": "critical", "closed_at": None}] * 3) == 0
    assert _experience_score([{"severity": "low", "closed_at": None}]) == 95
    assert _experience_score([{"severity": "critical", "closed_at": recent}]) == 100
    assert _financial_score([]) == 80
    assert _financial_score([{"status": "failed", "timestamp": recent}]) == 0
    assert _financial_score([{"status": "succeeded", "timestamp": recent}]) == 100
    assert _value_score([]) == 60
    assert _value_score([{"metric_type": "nps", "score": 9}]) == 60
    assert _value_score([{"metric_type": "csat", "score": 12}]) == 100


def test_domain_models_reject_out_of_range_scores_and_probabilities():
    with pytest.raises(PydanticValidationError):
        HealthScore(
            account_id="x", generated_at=datetime.now(timezone.utc), adoption=101,
            engagement=50, experience=50, financial=50, value=50, overall=50,
        )
    with pytest.raises(PydanticValidationError):
        RiskPrediction(account_id="x", risk_type="cancellation", probability=-0.1, confidence=0.5)
    assert _risk("cancellation", 2, -1).model_dump()["probability"] == 1
    assert _risk("cancellation", 2, -1).model_dump()["confidence"] == 0


@pytest.mark.parametrize(
    ("code", "features", "triggered"),
    [
        ("payment", {"payment_failures_30d": 2, "subscription_status": "active"}, True),
        ("technical_support", {"open_critical_tickets": 1, "open_high_tickets": 0}, True),
        ("product_fit", {"core_feature_usage_rate": 0.2}, True),
        ("price_plan_fit", {"plan_utilization": 0.8, "price_objection_recorded": True}, True),
        ("lifecycle", {"project_end_recorded": True}, True),
        ("competitive", {"competitor_named": True, "export_spike": False}, True),
        ("disengagement", {}, False),
        ("unknown", {}, False),
    ],
)
def test_cause_rule_branches(code, features, triggered):
    result, confidence = _evaluate({"code": code}, features)
    assert result is triggered
    assert 0 <= confidence <= 1


def test_export_spike_compares_recent_activity_to_account_baseline():
    usage = ([{"feature": "exports"}] * 2) + ([{"feature": "core_workflow"}] * 3) + ([{"feature": "core_workflow"}] * 20)
    assert _export_spike(usage) is True
    assert _export_spike([]) is False
    assert _export_spike([{"feature": "exports"}] + [{"feature": "core_workflow"}] * 20) is False


def test_csv_parsing_validation_encoding_and_quarantine():
    rows = parse_csv(b"id,account_id,name\n1,a,Valid\n2,,Missing\n")
    assert len(rows) == 2
    assert validate_row(rows[0]) == (True, None)
    assert validate_row(rows[1]) == (False, "missing account_id")
    assert validate_row({"account_id": "a"}) == (False, "missing id")
    with pytest.raises(ValidationError, match="UTF-8"):
        parse_csv(b"\xff")

    class Table:
        def insert(self, row):
            if row["id"] == "explode":
                raise RuntimeError("duplicate")
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class DB:
        def table(self, name):
            return Table()

    inserted, quarantined = insert_valid(DB(), "events", [rows[0], rows[1], {"id": "explode", "account_id": "a"}])
    assert inserted == 1
    assert [item["error"] for item in quarantined] == ["missing account_id", "duplicate"]


def test_freshness_and_data_quality_handle_missing_and_recent_sources():
    now = datetime.now(timezone.utc).isoformat()
    result = compute_freshness(
        [{"timestamp": now}], [], [{"opened_at": now}], [{"timestamp": now}],
    )
    assert result["product_usage"].endswith("min ago")
    assert result["billing"] == "no data"
    assert score_data_quality({"owner_id": "owner"}, [], []) == 60
    assert score_data_quality({}, [], []) == 40


def test_response_envelopes_have_unique_trace_metadata():
    first = envelope({"ok": True})
    second = envelope({"ok": True})
    assert first.errors == []
    assert first.meta.version == "v1"
    assert first.meta.request_id != second.meta.request_id
