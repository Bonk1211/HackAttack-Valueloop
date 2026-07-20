from fastapi import APIRouter, Depends
from supabase import Client
from app.deps import get_db
from app.models import envelope
from app.modules.health import score_health
from app.modules.risk import predict_risks
from app.modules.causes import generate_hypotheses
from app.modules.actions import recommend_actions

router = APIRouter()

@router.post("/accounts/{account_id}/analyze")
def analyze(account_id: str, db: Client = Depends(get_db)):
    health = score_health(db, account_id)
    risks = predict_risks(db, account_id)
    causes = generate_hypotheses(db, account_id)
    actions = recommend_actions(db, account_id)
    return envelope(data={
        "health": health.model_dump(mode="json"),
        "risks": [r.model_dump(mode="json") for r in risks],
        "causes": [c.model_dump(mode="json") for c in causes],
        "actions": [a.model_dump(mode="json") for a in actions],
    })
