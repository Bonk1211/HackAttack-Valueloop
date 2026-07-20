import pytest
from fastapi.testclient import TestClient

from app.deps import get_db
from app.main import create_app


@pytest.fixture()
def local_client():
    app = create_app()
    app.dependency_overrides[get_db] = lambda: None

    @app.get("/__test/boom")
    def boom():
        raise RuntimeError("database password must never escape")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def assert_error_envelope(response, code):
    body = response.json()
    assert response.status_code == code
    assert body["data"] is None
    assert body["meta"]["version"] == "v1"
    assert body["meta"]["request_id"]
    assert body["errors"][0]["code"] == code


def test_health_openapi_and_route_contract_are_available(local_client):
    assert local_client.get("/healthz").json() == {"status": "ok"}
    schema = local_client.get("/openapi.json").json()
    assert schema["info"]["title"] == "ValueLoop API"
    required = {
        "/api/v1/accounts", "/api/v1/accounts/{account_id}",
        "/api/v1/accounts/{account_id}/analyze", "/api/v1/interventions",
        "/api/v1/interventions/{intervention_id}",
        "/api/v1/interventions/{intervention_id}/outcome", "/api/v1/audit",
        "/api/v1/ingestion/csv",
    }
    assert required <= set(schema["paths"])


def test_validation_not_found_and_unexpected_errors_are_safe_envelopes(local_client):
    invalid = local_client.post("/api/v1/interventions", json={})
    assert_error_envelope(invalid, 422)
    assert invalid.json()["errors"][0]["message"] == "Request validation failed"

    missing = local_client.get("/route-that-does-not-exist")
    assert_error_envelope(missing, 404)
    assert missing.json()["errors"][0]["message"] == "Resource not found"

    unexpected = local_client.get("/__test/boom")
    assert_error_envelope(unexpected, 500)
    assert unexpected.json()["errors"][0]["message"] == "An unexpected error occurred"
    assert "password" not in unexpected.text


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/dashboard/trend?months=0", None),
        ("/api/v1/dashboard/trend?months=25", None),
        ("/api/v1/accounts/northstar/risk-history?days=0", None),
        ("/api/v1/audit?limit=0", None),
    ],
)
def test_query_bounds_reject_abusive_or_invalid_ranges(local_client, path, payload):
    response = local_client.get(path)
    assert_error_envelope(response, 422)


def test_csv_upload_rejects_wrong_extension_oversize_empty_and_malformed_rows(local_client):
    wrong_type = local_client.post("/api/v1/ingestion/csv", files={"file": ("data.txt", b"id,account_id\n1,a", "text/plain")})
    assert_error_envelope(wrong_type, 422)
    assert "Only .csv" in wrong_type.text

    oversize = local_client.post("/api/v1/ingestion/csv", files={"file": ("data.csv", b"x" * (5 * 1024 * 1024 + 1), "text/csv")})
    assert_error_envelope(oversize, 422)
    assert "5 MB" in oversize.text

    empty = local_client.post("/api/v1/ingestion/csv", files={"file": ("data.csv", b"", "text/csv")})
    assert_error_envelope(empty, 422)

    malformed = local_client.post("/api/v1/ingestion/csv", files={"file": ("data.csv", b"id,account_id\n1,", "text/csv")})
    assert_error_envelope(malformed, 422)
    assert "missing account_id" in malformed.text


def test_cors_allowlist_and_security_headers(local_client):
    trusted = local_client.options(
        "/api/v1/accounts",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert trusted.status_code == 200
    assert trusted.headers["access-control-allow-origin"] == "http://localhost:3000"

    untrusted = local_client.options(
        "/api/v1/accounts",
        headers={"Origin": "https://attacker.example", "Access-Control-Request-Method": "GET"},
    )
    assert untrusted.status_code == 400
    assert "access-control-allow-origin" not in untrusted.headers

    response = local_client.get("/healthz")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "camera=()" in response.headers["permissions-policy"]
