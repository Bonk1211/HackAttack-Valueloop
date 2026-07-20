import useSWR from 'swr';
import {
  getAccounts, getCustomer360, analyzeAccount, getDashboardKPIs,
  getInterventions, getOutcomes, getAudit, getTimeline,
  getDashboardTrend, getDashboardActionMix,
} from './api';
import {
  adaptAccount, adaptKPIs,
  type FrontendKPIs,
} from './adapters';
import type { Account } from './mock-data';
import type {
  BackendAccount, Analysis, Intervention, Outcome, AuditLog, TimelineEvent,
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

type AccountRow = BackendAccount & { analysis?: Analysis };

function accountsFetcher(includeAnalysis: boolean): () => Promise<Account[]> {
  return async () => {
    const raw = (await getAccounts(includeAnalysis)) as AccountRow[];
    return raw.map((r) => adaptAccount(r, includeAnalysis ? r.analysis : undefined));
  };
}

export function useAccounts(includeAnalysis = false) {
  const key = `/accounts${includeAnalysis ? '?include=analysis' : ''}`;
  const { data, error, isLoading } = useSWR<Account[]>(
    key,
    accountsFetcher(includeAnalysis),
    { fallbackData: mockAccounts, ...swrOpts },
  );
  return {
    data: data ?? mockAccounts,
    loading: isLoading,
    error,
    usingFallback: !data || !!error,
  };
}

// ─── Customer 360 ───────────────────────────────────────────────────────────────

export function useCustomer360(id: string | null) {
  const { data, error, isLoading } = useSWR<BackendAccount>(
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
    { fallbackData: [], ...swrOpts },
  );
  return {
    data: data ?? [],
    loading: isLoading,
    error,
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
  const { data, error, isLoading } = useSWR(
    `/dashboard/trend?months=${months}`,
    () => getDashboardTrend(months),
    { fallbackData: mockTrend, ...swrOpts },
  );
  return {
    data: data ?? mockTrend,
    loading: isLoading,
    error,
  };
}

// ─── Dashboard action mix ───────────────────────────────────────────────────────

export function useActionMix() {
  const { data, error, isLoading } = useSWR(
    '/dashboard/action-mix',
    () => getDashboardActionMix(),
    { fallbackData: mockActionMix, ...swrOpts },
  );
  return {
    data: data ?? mockActionMix,
    loading: isLoading,
    error,
  };
}
