from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

class Account(BaseModel):
    id: str
    name: str
    initials: str
    owner_id: str
    plan: str
    segment: str
    industry: str
    arr_mrr: float
    start_date: date
    renewal_date: date
    created_at: datetime | None = None
    updated_at: datetime | None = None

class User(BaseModel):
    id: str
    account_id: str
    role: str
    seat_status: str
    created_at: datetime | None = None

class Subscription(BaseModel):
    id: str
    account_id: str
    plan: str
    price: float
    status: str  # active | cancelled | paused | past_due
    renewal_date: date | None = None
    cancel_at: datetime | None = None
    created_at: datetime | None = None

class UsageEvent(BaseModel):
    id: str
    account_id: str
    user_id: str | None = None
    feature: str
    timestamp: datetime
    count: int = 0
    duration: float = 0.0

class PaymentEvent(BaseModel):
    id: str
    account_id: str
    timestamp: datetime
    status: str  # succeeded | failed | pending | refunded
    amount: float
    attempt: int = 1
    failure_code: str | None = None

class SupportTicket(BaseModel):
    id: str
    account_id: str
    severity: str  # critical | high | medium | low
    category: str
    opened_at: datetime
    closed_at: datetime | None = None
    sentiment: str | None = None
    resolution: str | None = None

class FeedbackEvent(BaseModel):
    id: str
    account_id: str
    metric_type: str  # nps | csat | verbatim
    score: float | None = None
    text: str | None = None
    timestamp: datetime

class HealthScore(BaseModel):
    account_id: str
    generated_at: datetime
    adoption: float = Field(ge=0, le=100)
    engagement: float = Field(ge=0, le=100)
    experience: float = Field(ge=0, le=100)
    financial: float = Field(ge=0, le=100)
    value: float = Field(ge=0, le=100)
    overall: float = Field(ge=0, le=100)
    version: str = "1.0"

class RiskPrediction(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    account_id: str
    risk_type: str  # cancellation | downgrade | inactivity | payment_failure | expansion_readiness
    probability: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    top_features_json: list[dict[str, Any]] = Field(default_factory=list)
    model_version: str = "1.0"
    generated_at: datetime | None = None

class CauseHypothesis(BaseModel):
    account_id: str
    cause: str  # payment | technical_support | product_fit | price_plan_fit | disengagement | lifecycle | competitive | unknown
    rank: int
    confidence: float = Field(ge=0, le=1)
    evidence_json: list[dict[str, Any]] = Field(default_factory=list)
    contradictions_json: list[dict[str, Any]] = Field(default_factory=list)
    rule_version: str = "1.0"
    generated_at: datetime | None = None
    unknown_reason: str | None = None

class ActionRecommendation(BaseModel):
    account_id: str
    action_code: str
    eligibility: bool
    rejection_reason: str | None = None
    utility_score: float | None = None
    approval_required: bool
    approval_reason: str | None = None
    benefit: str | None = None  # high | medium | low
    friction: str | None = None
    risk: str | None = None
    generated_at: datetime | None = None

class Intervention(BaseModel):
    id: str
    account_id: str
    recommended_action: str
    final_action: str | None = None
    approver: str | None = None
    status: str  # pending | approved | rejected | modified | executed | delivered
    channel: str | None = None
    reason: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

class Outcome(BaseModel):
    intervention_id: str
    renewed: bool | None = None
    downgraded: bool | None = None
    churned: bool | None = None
    usage_delta: float | None = None
    health_delta: float | None = None
    response: str | None = None
    observation: str | None = None
    recorded_at: datetime | None = None

class AuditLog(BaseModel):
    actor_id: str
    actor_role: str  # csm | manager | system
    action: str
    entity_type: str
    entity_id: str
    before_json: dict[str, Any] | None = None
    after_json: dict[str, Any] | None = None
    timestamp: datetime | None = None
    reason: str | None = None
