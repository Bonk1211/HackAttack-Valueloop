from fastapi import APIRouter
from app.api.v1 import accounts, timeline, health, risks, causes, actions, interventions, audit

api_router = APIRouter()
api_router.include_router(accounts.router, tags=["accounts"])
api_router.include_router(timeline.router, tags=["timeline"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(risks.router, tags=["risks"])
api_router.include_router(causes.router, tags=["causes"])
api_router.include_router(actions.router, tags=["actions"])
api_router.include_router(interventions.router, tags=["interventions"])
api_router.include_router(audit.router, tags=["audit"])
