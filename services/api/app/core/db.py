from supabase import Client, create_client
from app.config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_service_role_key)
    return _client


def new_supabase() -> Client:
    """Fresh, uncached client — the shared client's HTTP/2 connection isn't
    safe to hit from multiple threads at once, so parallel per-account
    analysis needs one client per worker thread rather than the singleton."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)
