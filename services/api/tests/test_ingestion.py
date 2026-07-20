"""Tests for CSV ingestion endpoint."""


def test_csv_ingestion_rejects_missing_account_id(client):
    import io
    csv_bytes = b"id,name,initials\n,Missing ID,MI\n"
    r = client.post("/api/v1/ingestion/csv",
                    files={"file": ("bad.csv", io.BytesIO(csv_bytes), "text/csv")})
    assert r.status_code == 422
