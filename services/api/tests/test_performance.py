import time

import pytest


pytestmark = [pytest.mark.integration, pytest.mark.performance]


def test_dashboard_meets_three_second_budget(client):
    client.get("/api/v1/accounts")
    started = time.perf_counter()
    response = client.get("/api/v1/accounts")
    elapsed = time.perf_counter() - started
    assert response.status_code == 200
    assert len(response.json()["data"]) == 50
    assert elapsed < 3.0, f"dashboard account list took {elapsed:.3f}s"


def test_account_analysis_meets_two_second_budget(client):
    client.post("/api/v1/accounts/northstar/analyze")
    started = time.perf_counter()
    response = client.post("/api/v1/accounts/northstar/analyze")
    elapsed = time.perf_counter() - started
    assert response.status_code == 200
    assert elapsed < 2.0, f"Northstar analysis took {elapsed:.3f}s"
