from fastapi import APIRouter
from app.api.v1 import accounts, timeline, health

api_router = APIRouter()
api_router.include_router(accounts.router, tags=["accounts"])
api_router.include_router(timeline.router, tags=["timeline"])
api_router.include_router(health.router, tags=["health"])
