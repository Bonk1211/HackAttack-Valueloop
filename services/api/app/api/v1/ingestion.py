from fastapi import APIRouter, Depends, UploadFile, File
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.ingestion import parse_csv, validate_row
import secrets

router = APIRouter()

# In-memory job store (prototype only)
JOBS: dict[str, dict] = {}

@router.post("/ingestion/csv")
async def upload_csv(file: UploadFile = File(...), db: Client = Depends(get_db)):
    contents = await file.read()
    rows = parse_csv(contents)
    if not rows:
        from app.core.errors import ValidationError
        raise ValidationError("CSV is empty")

    # Pre-validate: reject whole file if any row missing account_id
    for row in rows:
        ok, err = validate_row(row)
        if not ok:
            from app.core.errors import ValidationError
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
