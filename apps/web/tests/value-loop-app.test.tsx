import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ValueLoopApp } from '@/components/value-loop-app';
import { accounts } from '@/lib/mock-data';

const push = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/use-swr', () => ({
  useAccounts: () => ({ data: accounts, raw: [], analyses: {}, loading: false, error: undefined, usingFallback: true, refresh: vi.fn() }),
  useCustomer360: () => ({ data: undefined, loading: false, error: undefined, usingFallback: true }),
  useAnalysis: () => ({ data: undefined, loading: false, error: undefined, usingFallback: true }),
  useTimeline: () => ({ data: [], loading: false, error: undefined, usingFallback: true }),
  useKPIs: () => ({ data: { totalAccounts: 50, atRiskMrr: 'RM 48,000', acceptanceRate: '72%', overrideRate: '14%' }, loading: false }),
  useInterventions: () => ({ data: [], loading: false, refresh: vi.fn() }),
  useOutcomes: () => ({ data: [], loading: false }),
  useAudit: () => ({ data: [], loading: false }),
  useTrend: () => ({ data: [], loading: false }),
  useActionMix: () => ({ data: { entries: [], totalEligible: 0 }, loading: false }),
  useRiskHistory: () => ({ data: [], loading: false, refresh: vi.fn() }),
}));

describe('ValueLoop application shell', () => {
  it('renders semantic navigation, a skip link, and a single page heading', () => {
    render(<ValueLoopApp initialScreen="overview" />);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Catch value loss before it becomes churn');
    expect(screen.getByRole('button', { name: 'View notifications' })).toHaveAccessibleName();
  });

  it('routes primary actions and exposes the contextual tutorial', () => {
    render(<ValueLoopApp initialScreen="overview" />);
    fireEvent.click(screen.getByRole('button', { name: /open risk queue/i }));
    expect(push).toHaveBeenCalledWith('/risk-queue');

    fireEvent.click(screen.getByRole('button', { name: /page tutorial/i }));
    expect(screen.getByText('Start with the page question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close tutorial/i })).toBeInTheDocument();
  });

  it('supports keyboard discoverability for account search and mobile navigation', () => {
    render(<ValueLoopApp initialScreen="accounts" />);
    expect(screen.getByRole('textbox', { name: 'Search accounts' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);
  });
});
