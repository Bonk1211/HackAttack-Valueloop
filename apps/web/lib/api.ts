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

export const getAccounts = (includeAnalysis = false) =>
  api<any[]>(`/accounts${includeAnalysis ? '?include=analysis' : ''}`);

export const getCustomer360 = (id: string) =>
  api<any>(`/accounts/${id}`);

export const getTimeline = (id: string) =>
  api<any[]>(`/accounts/${id}/timeline`);

export const analyzeAccount = (id: string) =>
  api<any>(`/accounts/${id}/analyze`, { method: 'POST' });

export const getDashboardKPIs = () =>
  api<any>('/dashboard/kpis');

export const getDashboardTrend = (months = 6) =>
  api<any[]>(`/dashboard/trend?months=${months}`);

export const getDashboardActionMix = () =>
  api<any[]>('/dashboard/action-mix');

export const getInterventions = (status?: string, accountId?: string) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (accountId) params.set('account_id', accountId);
  const qs = params.toString();
  return api<any[]>(`/interventions${qs ? `?${qs}` : ''}`);
};

export const createIntervention = (body: { account_id: string; recommended_action: string }) =>
  api<any>('/interventions', { method: 'POST', body: JSON.stringify(body) });

export const transitionIntervention = (id: string, body: { status: string; actor_id?: string; actor_role?: string; reason?: string; final_action?: string }) =>
  api<any>(`/interventions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const recordOutcome = (id: string, body: any) =>
  api<any>(`/interventions/${id}/outcome`, { method: 'POST', body: JSON.stringify(body) });

export const getOutcomes = (interventionId?: string) => {
  const qs = interventionId ? `?intervention_id=${interventionId}` : '';
  return api<any[]>(`/outcomes${qs}`);
};

export const getAudit = (params: Record<string, string> = {}) =>
  api<any[]>(`/audit?${new URLSearchParams(params)}`);

export const getRiskHistory = (accountId: string, days = 7) =>
  api<any[]>(`/accounts/${accountId}/risk-history?days=${days}`);
