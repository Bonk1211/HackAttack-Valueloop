import useSWR from 'swr';
import {
  getAccounts, getCustomer360, analyzeAccount, getDashboardKPIs,
  getInterventions, getOutcomes, getAudit, getTimeline,
  getDashboardTrend, getDashboardActionMix,
  getRiskHistory,
  type AccountRow,
} from './api';
import {
  adaptAccount, adaptKPIs, adaptTrend, adaptActionMix,
  type FrontendKPIs, type FrontendTrendPoint, type FrontendActionMix,
} from './adapters';
import type {
  Analysis, Intervention, Outcome, AuditLog, TimelineEvent, Customer360Response,
  RiskHistoryPoint,
} from './api-types';
import {
  accounts as mockAccounts,
  portfolioTrend as mockTrend,
  actionMix as mockActionMix,
} from './mock-data';

// ─── Mock KPIs (match display when API is down) ────────────────────────────────

export const MOCK_KPIS: FrontendKPIs = {
  totalAccounts: mockAccounts.length,
  atRiskMrr: 'RM 48.0k',
  acceptanceRate: '72%',
  overrideRate: '14%',
};

// ─── SWR common options ────────────────────────────────────────────────────────

const swrOpts = { revalidateOnFocus: false, shouldRetryOnError: false };

// ─── Accounts ───────────────────────────────────────────────────────────────────

export function useAccounts(includeAnalysis = false) {
  const key = `/accounts${includeAnalysis ? '?include=analysis' : ''}`;
  const { data, error, isLoading, mutate } = useSWR<AccountRow[]>(
    key,
    () => getAccounts(includeAnalysis),
    swrOpts,
  );
  const adapted = data?.map((row) => adaptAccount(row, includeAnalysis ? row.analysis : undefined)) ?? mockAccounts;
  const analyses = Object.fromEntries((data ?? []).flatMap((row) => row.analysis ? [[row.id, row.analysis]] : []));
  return {
    data: adapted,
    raw: data ?? [],
    analyses,
    loading: isLoading,
    error,
    usingFallback: !!error,
    refresh: mutate,
  };
}

// ─── Customer 360 ───────────────────────────────────────────────────────────────

export function useCustomer360(id: string | null) {
  const { data, error, isLoading } = useSWR<Customer360Response>(
    id ? `/accounts/${id}` : null,
    () => getCustomer360(id!),
    swrOpts,
  );
  return {
    data,
    loading: isLoading,
    error,
    usingFallback: !data && !isLoading,
  };
}

// ─── Analysis (health, risks, causes, actions) ──────────────────────────────────

export function useAnalysis(id: string | null) {
  const { data, error, isLoading } = useSWR<Analysis>(
    id ? `/accounts/${id}/analyze` : null,
    () => analyzeAccount(id!),
    swrOpts,
  );
  return {
    data,
    loading: isLoading,
    error,
    usingFallback: !data && !isLoading,
  };
}

// ─── Timeline ───────────────────────────────────────────────────────────────────

export function useTimeline(id: string | null) {
  const { data, error, isLoading } = useSWR<TimelineEvent[]>(
    id ? `/accounts/${id}/timeline` : null,
    () => getTimeline(id!),
    swrOpts,
  );
  return {
    data: data ?? [],
    loading: isLoading,
    error,
    usingFallback: !data && !isLoading,
  };
}

export function useRiskHistory(id: string | null, days = 7) {
  const { data, error, isLoading, mutate } = useSWR<RiskHistoryPoint[]>(
    id ? `/accounts/${id}/risk-history?days=${days}` : null,
    () => getRiskHistory(id!, days),
    swrOpts,
  );
  return {
    data: data ?? [],
    loading: isLoading,
    error,
    usingFallback: !!error,
    refresh: mutate,
  };
}

// ─── KPIs ───────────────────────────────────────────────────────────────────────

export function useKPIs() {
  const { data, error, isLoading } = useSWR<FrontendKPIs>(
    '/dashboard/kpis',
    async () => adaptKPIs(await getDashboardKPIs()),
    { fallbackData: MOCK_KPIS, ...swrOpts },
  );
  return {
    data: data ?? MOCK_KPIS,
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
  };
}

// ─── Interventions ──────────────────────────────────────────────────────────────

export function useInterventions(status?: string) {
  const key = status ? `/interventions?status=${status}` : '/interventions';
  const { data, error, isLoading, mutate } = useSWR<Intervention[]>(
    key,
    () => getInterventions(status),
    { fallbackData: [], ...swrOpts },
  );
  return {
    data: data ?? [],
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
    refresh: mutate,
  };
}

// ─── Outcomes ───────────────────────────────────────────────────────────────────

export function useOutcomes() {
  const { data, error, isLoading } = useSWR<Outcome[]>(
    '/outcomes',
    () => getOutcomes(),
    { fallbackData: [], ...swrOpts },
  );
  return {
    data: data ?? [],
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
  };
}

// ─── Audit Log ──────────────────────────────────────────────────────────────────

export function useAudit(params: Record<string, string> = {}) {
  const key = `/audit?${new URLSearchParams(params)}`;
  const { data, error, isLoading } = useSWR<AuditLog[]>(
    key,
    () => getAudit(params),
    { fallbackData: [], ...swrOpts },
  );
  return {
    data: data ?? [],
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
  };
}

// ─── Dashboard trend (at-risk MRR) ──────────────────────────────────────────────

export function useTrend(months = 6) {
  const { data, error, isLoading } = useSWR<FrontendTrendPoint[]>(
    `/dashboard/trend?months=${months}`,
    async () => adaptTrend(await getDashboardTrend(months)),
    { fallbackData: mockTrend, ...swrOpts },
  );
  return {
    data: data ?? mockTrend,
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
  };
}

// ─── Dashboard action mix ───────────────────────────────────────────────────────

const mockActionMixShaped: FrontendActionMix = { entries: mockActionMix, totalEligible: 50 };

export function useActionMix() {
  const { data, error, isLoading } = useSWR<FrontendActionMix>(
    '/dashboard/action-mix',
    async () => adaptActionMix(await getDashboardActionMix()),
    { fallbackData: mockActionMixShaped, ...swrOpts },
  );
  return {
    data: data ?? mockActionMixShaped,
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
  };
}
