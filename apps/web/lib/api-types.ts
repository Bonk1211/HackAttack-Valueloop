export interface BackendAccount {
  id: string;
  name: string;
  initials: string;
  owner_id: string;
  plan: string;
  segment: string;
  industry: string;
  arr_mrr: number;
  start_date: string;
  renewal_date: string;
}

export interface HealthScore {
  adoption: number;
  engagement: number;
  experience: number;
  financial: number;
  value: number;
  overall: number;
  version: string;
  generated_at: string;
}

export interface RiskPrediction {
  account_id: string;
  risk_type: string;
  probability: number;
  confidence: number;
  top_features_json: { feature: string; value: unknown }[];
  model_version: string;
  generated_at: string;
}

export interface CauseHypothesis {
  account_id: string;
  cause: string;
  rank: number;
  confidence: number;
  evidence_json: { feature: string; source: string }[];
  contradictions_json: { feature: string; source: string }[];
  rule_version: string;
  generated_at: string;
  unknown_reason: string | null;
}

export interface ActionRecommendation {
  account_id: string;
  action_code: string;
  eligibility: boolean;
  rejection_reason: string | null;
  utility_score: number | null;
  approval_required: boolean;
  approval_reason: string | null;
  benefit: string | null;
  friction: string | null;
  risk: string | null;
  generated_at: string;
}

export interface Analysis {
  health: HealthScore;
  risks: RiskPrediction[];
  causes: CauseHypothesis[];
  actions: ActionRecommendation[];
}

export interface Customer360Response {
  account: BackendAccount;
  subscription: { status: string; renewal_date: string; cancel_at: string | null } | null;
  users: { id: string; name: string; role: string }[];
  freshness: Record<string, string>;
  data_quality: number;
}

export interface RiskHistoryPoint {
  date: string;
  risks: RiskPrediction[];
}

export interface IngestionResult {
  job_id: string;
  inserted: number;
  quarantined: Array<Record<string, unknown>>;
}

export interface IngestionJob {
  status: string;
  rows: number;
  quarantined: Array<Record<string, unknown>>;
}

export interface Intervention {
  id: string;
  account_id: string;
  recommended_action: string;
  final_action: string | null;
  approver: string | null;
  status: string;
  channel: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Outcome {
  intervention_id: string;
  renewed: boolean | null;
  downgraded: boolean | null;
  churned: boolean | null;
  usage_delta: number | null;
  health_delta: number | null;
  response: string | null;
  observation: string | null;
  recorded_at: string;
}

export interface AuditLog {
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  timestamp: string;
  reason: string | null;
}

export interface KPIs {
  total_accounts: number;
  at_risk_mrr: number;
  intervention_acceptance_rate: number;
  override_rate: number;
}

export interface TrendPoint {
  month: string;
  mrr: number;
}

export interface ActionMixEntry {
  name: string;
  eligible: number;
  rejected: number;
}

export interface TimelineEvent {
  kind: string;
  title: string;
  meta: string;
  timestamp: string;
  raw?: Record<string, unknown>;
}
