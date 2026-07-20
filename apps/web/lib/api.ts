import type {
  ActionMixEntry, Analysis, AuditLog, BackendAccount, CauseHypothesis,
  Customer360Response, HealthScore, IngestionJob, IngestionResult, Intervention,
  KPIs, Outcome, RiskHistoryPoint, RiskPrediction, TimelineEvent, TrendPoint,
  ActionRecommendation,
} from './api-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const envelope = await res.json();
  if (envelope.errors?.length) throw new Error(envelope.errors[0].message);
  return envelope.data as T;
}

export type AccountRow = BackendAccount & { analysis?: Analysis };

export const getAccounts = (includeAnalysis = false) =>
  api<AccountRow[]>(`/accounts${includeAnalysis ? '?include=analysis' : ''}`);

export const getCustomer360 = (id: string) =>
  api<Customer360Response>(`/accounts/${id}`);

export const getTimeline = (id: string) =>
  api<TimelineEvent[]>(`/accounts/${id}/timeline`);

export const getHealth = (id: string) => api<HealthScore>(`/accounts/${id}/health`);
export const getRisks = (id: string) => api<RiskPrediction[]>(`/accounts/${id}/risks`);
export const getCauses = (id: string) => api<CauseHypothesis[]>(`/accounts/${id}/causes`);
export const getActions = (id: string) => api<ActionRecommendation[]>(`/accounts/${id}/actions`);

export const analyzeAccount = (id: string) =>
  api<Analysis>(`/accounts/${id}/analyze`, { method: 'POST' });

export const getDashboardKPIs = () =>
  api<KPIs>('/dashboard/kpis');

export const getDashboardTrend = (months = 6) =>
  api<TrendPoint[]>(`/dashboard/trend?months=${months}`);

export const getDashboardActionMix = () =>
  api<ActionMixEntry[]>('/dashboard/action-mix');

export const getInterventions = (status?: string, accountId?: string) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (accountId) params.set('account_id', accountId);
  const qs = params.toString();
  return api<Intervention[]>(`/interventions${qs ? `?${qs}` : ''}`);
};

export const createIntervention = (body: { account_id: string; recommended_action: string; actor_id?: string; actor_role?: string }) =>
  api<Intervention>('/interventions', { method: 'POST', body: JSON.stringify(body) });

export const transitionIntervention = (id: string, body: { status: string; actor_id?: string; actor_role?: string; reason?: string; final_action?: string }) =>
  api<Intervention>(`/interventions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export type OutcomeInput = Omit<Outcome, 'intervention_id' | 'recorded_at'>;
export const recordOutcome = (id: string, body: OutcomeInput) =>
  api<Outcome>(`/interventions/${id}/outcome`, { method: 'POST', body: JSON.stringify(body) });

export const getOutcomes = (interventionId?: string) => {
  const qs = interventionId ? `?intervention_id=${interventionId}` : '';
  return api<Outcome[]>(`/outcomes${qs}`);
};

export const getAudit = (params: Record<string, string> = {}) =>
  api<AuditLog[]>(`/audit?${new URLSearchParams(params)}`);

export const getRiskHistory = (accountId: string, days = 7) =>
  api<RiskHistoryPoint[]>(`/accounts/${accountId}/risk-history?days=${days}`);

export const uploadIngestionCsv = (file: File) => {
  const body = new FormData();
  body.append('file', file);
  return api<IngestionResult>('/ingestion/csv', { method: 'POST', body, headers: {} });
};

export const getIngestionJob = (jobId: string) =>
  api<IngestionJob>(`/ingestion/jobs/${jobId}`);
