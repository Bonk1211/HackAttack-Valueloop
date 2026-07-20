import type { Account, Severity, ChurnType, ChurnProfile, CauseHypothesis, ActionPolicy, EvidenceItem } from './mock-data';
import type {
  BackendAccount,
  Analysis,
  KPIs,
  AuditLog,
  TimelineEvent,
  CauseHypothesis as BackendCause,
  ActionRecommendation,
  HealthScore,
  RiskPrediction,
  RiskHistoryPoint,
  TrendPoint,
  ActionMixEntry,
} from './api-types';

// ─── Action code → human-readable label (mirrors policies/actions.yaml) ──────────

export const ACTION_LABELS: Record<string, string> = {
  in_app_education: 'Guided onboarding',
  payment_retry: 'Payment retry & card update',
  support_escalation: 'Support escalation',
  human_outreach: 'Human outreach',
  plan_review: 'Flexible plan review',
  pause_subscription: 'Pause subscription',
  upgrade_review: 'Upgrade review',
  no_action: 'No action',
};

export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// ─── Cause code → human-readable churn type ───────────────────────────────────

const CAUSE_TO_CHURN: Record<string, ChurnType> = {
  technical_support: 'Experience churn',
  experience: 'Experience churn',
  value_realization: 'Value churn',
  value: 'Value churn',
  product_fit: 'Product-fit churn',
  product: 'Product-fit churn',
  price_plan_fit: 'Price churn',
  price: 'Price churn',
  payment: 'Involuntary churn',
  competitive: 'Competitive churn',
  lifecycle: 'Lifecycle churn',
  disengagement: 'Silent churn',
  unknown: 'Silent churn',
};

export function causeToChurnType(cause: string): string {
  const key = cause.toLowerCase().replace(/[\s-]+/g, '_');
  return CAUSE_TO_CHURN[key] ?? 'Silent churn';
}

// ─── Score → tone ───────────────────────────────────────────────────────────────

export function scoreTone(score: number): 'good' | 'warning' | 'critical' {
  if (score >= 70) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

// ─── Risk probability → severity ────────────────────────────────────────────────

export function riskToSeverity(probability: number): Severity {
  if (probability >= 80) return 'Critical';
  if (probability >= 60) return 'High';
  if (probability >= 40) return 'Medium';
  return 'Low';
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatMrr(value: number | null | undefined): string {
  if (value == null) return 'RM 0';
  return `RM ${value.toLocaleString('en-US')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function topRisk(risks: RiskPrediction[]): RiskPrediction | undefined {
  if (risks.length === 0) return undefined;
  return [...risks].sort((a, b) => b.probability - a.probability)[0];
}

function eligibleAction(actions: ActionRecommendation[]): ActionRecommendation | undefined {
  return actions.find((a) => a.eligibility);
}

// ─── Health score → frontend tuple array ─────────────────────────────────────────

type HealthTuple = readonly [string, number, number, 'critical' | 'warning' | 'positive'];

function healthToTuples(h: HealthScore): HealthTuple[] {
  // delta is not available in single snapshot; use 0
  const dims: Array<[string, number]> = [
    ['Adoption', h.adoption],
    ['Engagement', h.engagement],
    ['Experience', h.experience],
    ['Financial', h.financial],
    ['Value', h.value],
  ];
  return dims.map(([label, val]) => {
    const tone = val >= 70 ? 'positive' : val >= 50 ? 'warning' : 'critical';
    return [label, val, 0, tone] as const;
  });
}

// ─── Backend cause → frontend CauseHypothesis ──────────────────────────────────

// Human-readable text for each evidence feature code (mirrors policies/cause_rules.yaml,
// whose supporting_evidence/contradicting_evidence lists are snake_case codes with no
// prose — the frontend needs a sentence, not "competitor_named").
const EVIDENCE_LABELS: Record<string, string> = {
  failed_attempts: 'Recent payment attempts have failed',
  expiry_risk: 'Card on file is near expiry',
  payment_status_past_due: 'Subscription payment is past due',
  payments_current: 'Payments are current',
  no_failures: 'No recent payment failures',
  high_severity: 'Open high-severity support tickets',
  repeat_tickets: 'Repeat support tickets on the same issue',
  long_unresolved: 'Tickets have remained unresolved for an extended period',
  no_tickets: 'No open support tickets',
  rapid_resolution: 'Recent tickets resolved quickly',
  core_feature_not_used: 'Core workflow feature is not being used',
  adoption_low_after_onboarding: 'Adoption remained low after onboarding',
  high_goal_completion: 'Success-plan goals are being completed',
  low_utilization_relative_to_plan: 'Usage is low relative to the current plan',
  price_objections: 'Price objections recorded in feedback',
  near_limits: 'Usage is near current plan limits',
  high_value: 'Account is realizing high value from the plan',
  declining_active_days: 'Active usage days have declined',
  declining_logins: 'Login frequency has declined',
  stable_value_outcomes: 'Value outcomes have remained stable',
  seasonality: 'Usage pattern matches a seasonal dip',
  temporary_pause: 'Account activity matches a temporary pause',
  project_end: 'Signals match a completed project lifecycle',
  persistent_negative_experience: 'Negative experience signals persist',
  competitor_named: 'A named competitor was mentioned in feedback',
  exports_increased: 'Data export activity has spiked',
  feature_gap: 'A confirmed feature gap was raised',
  long_contract_remaining: 'Significant contract term remains',
};

function evidenceLabel(feature: string): string {
  return EVIDENCE_LABELS[feature] ?? feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function adaptEvidence(items: { feature: string; source: string }[], timestamp: string): EvidenceItem[] {
  return items.map((e) => ({ text: evidenceLabel(e.feature), source: e.source.replace(/\b\w/g, (l) => l.toUpperCase()), timestamp }));
}

function adaptCause(c: BackendCause): CauseHypothesis {
  const conf = c.confidence;
  const strength = conf >= 0.7 ? 'Strong evidence' : conf >= 0.4 ? 'Moderate evidence' : 'Weak evidence';
  const timestamp = timeAgo(c.generated_at);
  return {
    label: c.cause.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    confidence: conf,
    strength,
    supporting: adaptEvidence(c.evidence_json, timestamp),
    contradicting: adaptEvidence(c.contradictions_json, timestamp),
  };
}

// ─── Backend action → frontend ActionPolicy ────────────────────────────────────

function capLabel(s: string | null): 'High' | 'Medium' | 'Low' {
  const v = (s ?? 'medium').toLowerCase();
  if (v === 'high') return 'High';
  if (v === 'low') return 'Low';
  return 'Medium';
}

function adaptAction(a: ActionRecommendation): ActionPolicy {
  return {
    recommended: actionLabel(a.action_code),
    description: `${actionLabel(a.action_code)} is eligible under the current policy and evidence.`,
    benefit: capLabel(a.benefit),
    friction: capLabel(a.friction),
    risk: capLabel(a.risk),
    approvalRequired: a.approval_required,
    approvalReason: a.approval_reason ?? '',
    explanation: a.approval_reason ?? `Policy utility score ${a.utility_score?.toFixed(2) ?? 'not ranked'}.`,
    checks: ['Eligibility rules passed', 'Consent and frequency policy checked'],
    rejected: [],
  };
}

// ─── Main adapters ──────────────────────────────────────────────────────────────

export function adaptAccount(backend: BackendAccount, analysis?: Analysis): Account {
  // topRisk().probability is a 0-1 fraction from the backend; the frontend's
  // Account/ChurnProfile types (and riskToSeverity's thresholds) expect 0-100.
  const riskPct = analysis ? Math.round((topRisk(analysis.risks)?.probability ?? 0) * 100) : 0;
  const top = analysis ? topRisk(analysis.risks) : undefined;
  const action = analysis ? eligibleAction(analysis.actions) : undefined;
  const topCause = analysis && analysis.causes.length > 0
    ? [...analysis.causes].sort((a, b) => a.rank - b.rank)[0]
    : undefined;

  return {
    id: backend.id,
    name: backend.name,
    initials: backend.initials,
    owner: backend.owner_id,
    plan: backend.plan,
    segment: backend.segment,
    industry: backend.industry,
    mrr: formatMrr(backend.arr_mrr),
    risk: riskPct,
    riskType: top?.risk_type ?? '',
    churnType: topCause ? (causeToChurnType(topCause.cause) as ChurnType) : undefined,
    severity: riskToSeverity(riskPct),
    health: analysis ? analysis.health.overall : 0,
    delta: 0,
    renewal: formatDate(backend.renewal_date),
    freshness: analysis ? timeAgo(analysis.health.generated_at) : 'Analysis pending',
    action: action ? action.action_code.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '',
  };
}

export function adaptChurnProfile(analysis: Analysis, account: BackendAccount): ChurnProfile {
  const top = topRisk(analysis.risks);
  const sortedCauses = [...analysis.causes].sort((a, b) => a.rank - b.rank);
  const topCause = sortedCauses[0];
  const eligible = analysis.actions
    .filter((candidate) => candidate.eligibility)
    .sort((a, b) => (b.utility_score ?? -1) - (a.utility_score ?? -1));
  const action = eligible.find((candidate) => candidate.action_code !== 'no_action') ?? eligible[0];
  const rejected = analysis.actions
    .filter((candidate) => !candidate.eligibility)
    .map((candidate) => ({ name: actionLabel(candidate.action_code), reason: candidate.rejection_reason ?? 'Policy requirements were not met.' }));

  const churnType = topCause ? (causeToChurnType(topCause.cause) as ChurnType) : 'Silent churn';
  const probabilityPct = top ? Math.round(top.probability * 100) : 0;

  return {
    accountId: account.id,
    churnType,
    riskLabel: top?.risk_type ?? '',
    probability: probabilityPct,
    riskDelta: 0,
    summary: `Risk score ${probabilityPct}% based on ${analysis.causes.length} hypotheses.`,
    health: healthToTuples(analysis.health),
    riskHistory: [],
    causes: sortedCauses.map(adaptCause),
    action: action ? { ...adaptAction(action), rejected } : {
      recommended: 'No action',
      description: '',
      benefit: 'Low',
      friction: 'Low',
      risk: 'Low',
      approvalRequired: false,
      approvalReason: '',
      explanation: '',
      checks: [],
      rejected: [],
    },
    timeline: [],
    outcome: { status: '', response: '', usageDelta: '', healthDelta: '', observation: '' },
  };
}

export function adaptRiskHistory(points: RiskHistoryPoint[], riskType: string): Array<{ day: string; risk: number }> {
  return points.map((point) => {
    const match = point.risks.find((risk) => risk.risk_type === riskType) ?? topRisk(point.risks);
    const date = new Date(`${point.date}T00:00:00`);
    return {
      day: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      risk: Math.round((match?.probability ?? 0) * 100),
    };
  });
}

export interface FrontendKPIs {
  totalAccounts: number;
  atRiskMrr: string;
  acceptanceRate: string;
  overrideRate: string;
}

export function adaptKPIs(backend: KPIs): FrontendKPIs {
  return {
    totalAccounts: backend.total_accounts,
    atRiskMrr: formatMrr(backend.at_risk_mrr),
    acceptanceRate: `${Math.round(backend.intervention_acceptance_rate * 100)}%`,
    overrideRate: `${Math.round(backend.override_rate * 100)}%`,
  };
}

export interface FrontendTimelineEvent {
  tone: 'critical' | 'warning' | 'positive' | 'blue';
  title: string;
  meta: string;
}

const KIND_LABELS: Record<string, string> = {
  usage: 'Product', support: 'Support', payment: 'Billing', feedback: 'Feedback',
};

function timelineTone(e: TimelineEvent): FrontendTimelineEvent['tone'] {
  const raw = e.raw ?? {};
  if (e.kind === 'support') {
    const severity = raw.severity;
    if (severity === 'critical' || severity === 'high') return 'critical';
    if (severity === 'medium') return 'warning';
    return 'blue';
  }
  if (e.kind === 'payment') {
    return raw.status === 'failed' ? 'critical' : 'positive';
  }
  if (e.kind === 'feedback') {
    return raw.sentiment === 'negative' ? 'warning' : 'positive';
  }
  return 'blue';
}

export function adaptTimeline(events: TimelineEvent[]): FrontendTimelineEvent[] {
  return events.map((e) => ({
    tone: timelineTone(e),
    title: `${KIND_LABELS[e.kind] ?? e.kind}: ${e.title}`,
    meta: `${KIND_LABELS[e.kind] ?? e.kind} · ${e.meta} · ${e.timestamp}`,
  }));
}

export interface FrontendAuditLog {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  reason: string | null;
}

export function adaptAuditLog(backend: AuditLog): FrontendAuditLog {
  return {
    actorId: backend.actor_id,
    actorRole: backend.actor_role,
    action: backend.action,
    entityType: backend.entity_type,
    entityId: backend.entity_id,
    before: backend.before_json,
    after: backend.after_json,
    timestamp: backend.timestamp,
    reason: backend.reason,
  };
}

// ─── Dashboard trend (portfolio MRR chart) ───────────────────────────────────────

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface FrontendTrendPoint {
  month: string;
  mrr: number;
}

export function adaptTrend(points: TrendPoint[]): FrontendTrendPoint[] {
  return points.map((p) => {
    const [, monthStr] = p.month.split('-');
    const label = MONTH_ABBR[Number(monthStr) - 1] ?? p.month;
    return { month: label, mrr: Math.round(p.mrr / 1000) };
  });
}

// ─── Dashboard action mix (donut) ────────────────────────────────────────────────

const ACTION_MIX_COLORS = [
  '#33483f', '#6f8a6f', '#8b7b65', '#b97a35', '#718078', '#c9c7bf', '#4a6670', '#a45c5c',
];

export interface FrontendActionMixEntry {
  name: string;
  value: number;
  fill: string;
}

export interface FrontendActionMix {
  entries: FrontendActionMixEntry[];
  totalEligible: number;
}

export function adaptActionMix(entries: ActionMixEntry[]): FrontendActionMix {
  const totalEligible = entries.reduce((sum, e) => sum + e.eligible, 0);
  const denom = totalEligible || 1;
  return {
    totalEligible,
    entries: entries
      .filter((e) => e.eligible > 0)
      .sort((a, b) => b.eligible - a.eligible)
      .map((e, i) => ({
        name: actionLabel(e.name),
        value: Math.round((e.eligible / denom) * 100),
        fill: ACTION_MIX_COLORS[i % ACTION_MIX_COLORS.length],
      })),
  };
}
