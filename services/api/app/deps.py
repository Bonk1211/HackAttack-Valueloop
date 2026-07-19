from typing import Iterator
from supabase import Client
from app.core.db import get_supabase


def get_db() -> Iterator[Client]:
    yield get_supabase()
