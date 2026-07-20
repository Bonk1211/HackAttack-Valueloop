from fastapi import APIRouter, Depends, UploadFile, File
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.ingestion import parse_csv, validate_row
import secrets

router = APIRouter()
MAX_CSV_BYTES = 5 * 1024 * 1024

# In-memory job store (prototype only)
JOBS: dict[str, dict] = {}

@router.post("/ingestion/csv")
async def upload_csv(file: UploadFile = File(...), db: Client = Depends(get_db)):
    from app.core.errors import ValidationError
    if not (file.filename or "").lower().endswith(".csv"):
        raise ValidationError("Only .csv files are accepted")
    contents = await file.read()
    if len(contents) > MAX_CSV_BYTES:
        raise ValidationError("CSV exceeds the 5 MB upload limit")
    rows = parse_csv(contents)
    if not rows:
        raise ValidationError("CSV is empty")

    # Pre-validate: reject whole file if any row missing account_id
    for row in rows:
        ok, err = validate_row(row)
        if not ok:
            raise ValidationError(f"Row validation failed: {err}")

    job_id = f"job-{secrets.token_hex(4)}"
    JOBS[job_id] = {"status": "parsed", "rows": len(rows), "quarantined": []}
    return envelope(data={"job_id": job_id, "inserted": len(rows), "quarantined": []})

@router.get("/ingestion/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS:
        from app.core.errors import NotFound
        raise NotFound("job", job_id)
    return envelope(data=JOBS[job_id])
