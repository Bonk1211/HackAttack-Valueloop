import type { PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAccounts,
  useActionMix,
  useAnalysis,
  useAudit,
  useCustomer360,
  useInterventions,
  useKPIs,
  useOutcomes,
  useRiskHistory,
  useTimeline,
  useTrend,
} from '@/lib/use-swr';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getAccounts: vi.fn(),
  getCustomer360: vi.fn(),
  analyzeAccount: vi.fn(),
  getDashboardKPIs: vi.fn(),
  getInterventions: vi.fn(),
  getOutcomes: vi.fn(),
  getAudit: vi.fn(),
  getTimeline: vi.fn(),
  getDashboardTrend: vi.fn(),
  getDashboardActionMix: vi.fn(),
  getRiskHistory: vi.fn(),
}));

const generatedAt = '2026-07-20T00:00:00Z';
const backendAccount = {
  id: 'northstar', name: 'Northstar Labs', initials: 'NL', owner_id: 'aisha', plan: 'Scale',
  segment: 'Enterprise', industry: 'Analytics', arr_mrr: 8200, start_date: '2025-01-01', renewal_date: '2026-08-12',
};
const analysis = {
  health: { adoption: 50, engagement: 50, experience: 35, financial: 100, value: 60, overall: 58, version: '1.0', generated_at: generatedAt },
  risks: [{ account_id: 'northstar', risk_type: 'cancellation', probability: 0.86, confidence: 0.8, top_features_json: [], model_version: '1.0', generated_at: generatedAt }],
  causes: [{ account_id: 'northstar', cause: 'technical_support', rank: 1, confidence: 0.76, evidence_json: [], contradictions_json: [], rule_version: '1.0', generated_at: generatedAt, unknown_reason: null }],
  actions: [{ account_id: 'northstar', action_code: 'support_escalation', eligibility: true, rejection_reason: null, utility_score: 0.8, approval_required: true, approval_reason: 'CSM required', benefit: 'high', friction: 'low', risk: 'low', generated_at: generatedAt }],
};

function wrapper({ children }: PropsWithChildren) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

describe('SWR integration hooks', () => {
  beforeEach(() => {
    vi.mocked(api.getAccounts).mockResolvedValue([{ ...backendAccount, analysis }]);
    vi.mocked(api.getCustomer360).mockResolvedValue({ account: backendAccount, subscription: null, users: [], freshness: {}, data_quality: 100 });
    vi.mocked(api.analyzeAccount).mockResolvedValue(analysis);
    vi.mocked(api.getTimeline).mockResolvedValue([{ kind: 'usage', title: 'Login', meta: 'count=1', timestamp: generatedAt }]);
    vi.mocked(api.getRiskHistory).mockResolvedValue([{ date: '2026-07-20', risks: analysis.risks }]);
    vi.mocked(api.getDashboardKPIs).mockResolvedValue({ total_accounts: 50, at_risk_mrr: 48000, intervention_acceptance_rate: 0.72, override_rate: 0.14 });
    vi.mocked(api.getDashboardTrend).mockResolvedValue([{ month: '2026-07', mrr: 48000 }]);
    vi.mocked(api.getDashboardActionMix).mockResolvedValue([{ name: 'support_escalation', eligible: 4, rejected: 1 }]);
    vi.mocked(api.getInterventions).mockResolvedValue([{ id: 'i-1', account_id: 'northstar', recommended_action: 'support_escalation', final_action: null, approver: null, status: 'pending', channel: null, reason: null, created_at: generatedAt, updated_at: generatedAt }]);
    vi.mocked(api.getOutcomes).mockResolvedValue([{ intervention_id: 'i-1', renewed: null, downgraded: null, churned: null, usage_delta: 10, health_delta: 5, response: 'Improved', observation: 'Observed', recorded_at: generatedAt }]);
    vi.mocked(api.getAudit).mockResolvedValue([{ actor_id: 'aisha', actor_role: 'csm', action: 'approved', entity_type: 'intervention', entity_id: 'i-1', before_json: null, after_json: {}, timestamp: generatedAt, reason: null }]);
  });

  it('adapts account analysis and exposes the raw contract', async () => {
    const { result } = renderHook(() => useAccounts(true), { wrapper });
    await waitFor(() => expect(result.current.raw).toHaveLength(1));
    expect(result.current.data[0]).toMatchObject({ name: 'Northstar Labs', risk: 86 });
    expect(result.current.analyses.northstar).toEqual(analysis);
    expect(result.current.usingFallback).toBe(false);
  });

  it('loads account detail, analysis, timeline, and risk history only when an id exists', async () => {
    const customer = renderHook(() => useCustomer360('northstar'), { wrapper });
    const analyzed = renderHook(() => useAnalysis('northstar'), { wrapper });
    const timeline = renderHook(() => useTimeline('northstar'), { wrapper });
    const history = renderHook(() => useRiskHistory('northstar', 7), { wrapper });
    await waitFor(() => expect(customer.result.current.data?.account.id).toBe('northstar'));
    await waitFor(() => expect(analyzed.result.current.data?.health.overall).toBe(58));
    await waitFor(() => expect(timeline.result.current.data).toHaveLength(1));
    await waitFor(() => expect(history.result.current.data).toHaveLength(1));

    const disabled = renderHook(() => useAnalysis(null), { wrapper });
    expect(disabled.result.current.loading).toBe(false);
    expect(disabled.result.current.data).toBeUndefined();
  });

  it('adapts portfolio dashboard resources', async () => {
    const kpis = renderHook(() => useKPIs(), { wrapper });
    const trend = renderHook(() => useTrend(6), { wrapper });
    const mix = renderHook(() => useActionMix(), { wrapper });
    await waitFor(() => expect(kpis.result.current.data.atRiskMrr).toBe('RM 48,000'));
    await waitFor(() => expect(trend.result.current.data).toEqual([{ month: 'Jul', mrr: 48 }]));
    await waitFor(() => expect(mix.result.current.data.totalEligible).toBe(4));
  });

  it('loads governed workflow, outcomes, and audit resources with filters', async () => {
    const interventions = renderHook(() => useInterventions('pending'), { wrapper });
    const outcomes = renderHook(() => useOutcomes(), { wrapper });
    const audit = renderHook(() => useAudit({ entity_type: 'intervention' }), { wrapper });
    await waitFor(() => expect(interventions.result.current.data[0].status).toBe('pending'));
    await waitFor(() => expect(outcomes.result.current.data[0].observation).toBe('Observed'));
    await waitFor(() => expect(audit.result.current.data[0].entity_id).toBe('i-1'));
    expect(api.getInterventions).toHaveBeenCalledWith('pending');
    expect(api.getAudit).toHaveBeenCalledWith({ entity_type: 'intervention' });
  });

  it('uses deterministic fallback data after an API failure', async () => {
    vi.mocked(api.getAccounts).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAccounts(true), { wrapper });
    await waitFor(() => expect(result.current.usingFallback).toBe(true));
    expect(result.current.data.length).toBeGreaterThan(0);
    expect(result.current.data[0].name).toBe('Northstar Labs');
  });
});
