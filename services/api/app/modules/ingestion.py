import csv
import io
import secrets
from datetime import datetime, timezone
from supabase import Client
from app.core.errors import ValidationError

def parse_csv(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]

def validate_row(row: dict) -> tuple[bool, str | None]:
    if not row.get("id"):
        return False, "missing id"
    if not row.get("account_id"):
        return False, "missing account_id"
    return True, None

def insert_valid(db: Client, entity: str, rows: list[dict]) -> tuple[int, list[dict]]:
    inserted = 0
    quarantined = []
    for row in rows:
        ok, err = validate_row(row)
        if not ok:
            quarantined.append({"row": row, "error": err})
            continue
        try:
            db.table(entity).insert(row).execute()
            inserted += 1
        except Exception as e:
            quarantined.append({"row": row, "error": str(e)})
    return inserted, quarantined
