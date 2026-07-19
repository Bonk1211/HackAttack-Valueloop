from datetime import datetime, timezone
from typing import Generic, TypeVar
from uuid import uuid4
from pydantic import BaseModel, Field

T = TypeVar("T")

class Meta(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = "v1"

class ErrorItem(BaseModel):
    code: int | None = None
    message: str

class ResponseEnvelope(BaseModel, Generic[T]):
    data: T | None
    meta: Meta = Field(default_factory=Meta)
    errors: list[ErrorItem] = Field(default_factory=list)

def envelope(data: T, errors: list[ErrorItem] | None = None) -> ResponseEnvelope[T]:
    return ResponseEnvelope(data=data, errors=errors or [])
