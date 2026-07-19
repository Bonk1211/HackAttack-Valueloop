from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    log_level: str = "INFO"
    api_version: str = "v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
