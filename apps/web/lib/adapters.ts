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
} from './api-types';

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

function adaptEvidence(items: { reason: string; source: string; timestamp: string }[]): EvidenceItem[] {
  return items.map((e) => ({ text: e.reason, source: e.source, timestamp: e.timestamp }));
}

function adaptCause(c: BackendCause): CauseHypothesis {
  const conf = c.confidence;
  const strength = conf >= 0.7 ? 'Strong evidence' : conf >= 0.4 ? 'Moderate evidence' : 'Weak evidence';
  return {
    label: c.cause.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    confidence: conf,
    strength,
    supporting: adaptEvidence(c.evidence_json),
    contradicting: adaptEvidence(c.contradictions_json),
  };
}

// ─── Backend action → frontend ActionPolicy ────────────────────────────────────

function capLabel(s: string): 'High' | 'Medium' | 'Low' {
  const v = s.toLowerCase();
  if (v === 'high') return 'High';
  if (v === 'low') return 'Low';
  return 'Medium';
}

function adaptAction(a: ActionRecommendation): ActionPolicy {
  return {
    recommended: a.action_code.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    description: a.benefit,
    benefit: capLabel(a.benefit),
    friction: capLabel(a.friction),
    risk: capLabel(a.risk),
    approvalRequired: a.approval_required,
    approvalReason: a.approval_reason ?? '',
    explanation: a.benefit,
    checks: [],
    rejected: a.rejection_reason ? [{ name: a.action_code, reason: a.rejection_reason }] : [],
  };
}

// ─── Main adapters ──────────────────────────────────────────────────────────────

export function adaptAccount(backend: BackendAccount, analysis?: Analysis): Account {
  const risk = analysis ? (topRisk(analysis.risks)?.probability ?? 0) : 0;
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
    risk: Math.round(risk * 100) / 100,
    riskType: top?.risk_type ?? '',
    churnType: topCause ? (causeToChurnType(topCause.cause) as ChurnType) : undefined,
    severity: riskToSeverity(risk),
    health: analysis ? analysis.health.overall : 0,
    delta: 0,
    renewal: formatDate(backend.renewal_date),
    freshness: timeAgo(backend.start_date),
    action: action ? action.action_code.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '',
  };
}

export function adaptChurnProfile(analysis: Analysis, account: BackendAccount): ChurnProfile {
  const top = topRisk(analysis.risks);
  const sortedCauses = [...analysis.causes].sort((a, b) => a.rank - b.rank);
  const topCause = sortedCauses[0];
  const action = eligibleAction(analysis.actions);

  const churnType = topCause ? (causeToChurnType(topCause.cause) as ChurnType) : 'Silent churn';

  return {
    accountId: account.id,
    churnType,
    riskLabel: top?.risk_type ?? '',
    probability: top ? top.probability : 0,
    riskDelta: 0,
    summary: `Risk score ${Math.round((top?.probability ?? 0) * 100)}% based on ${analysis.causes.length} hypotheses.`,
    health: healthToTuples(analysis.health),
    riskHistory: [],
    causes: sortedCauses.map(adaptCause),
    action: action ? adaptAction(action) : {
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

export function adaptTimeline(events: TimelineEvent[]): FrontendTimelineEvent[] {
  return events.map((e) => {
    const tone = (['critical', 'warning', 'positive', 'blue'].includes(e.tone) ? e.tone : 'blue') as FrontendTimelineEvent['tone'];
    return {
      tone,
      title: e.title,
      meta: `${e.source} · ${e.timestamp}`,
    };
  });
}

export interface FrontendAuditLog {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before: any;
  after: any;
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
