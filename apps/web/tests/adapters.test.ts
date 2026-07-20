import {
  actionLabel,
  adaptAccount,
  adaptActionMix,
  adaptAuditLog,
  adaptChurnProfile,
  adaptKPIs,
  adaptRiskHistory,
  adaptTimeline,
  adaptTrend,
  causeToChurnType,
  riskToSeverity,
  scoreTone,
} from '@/lib/adapters';
import type { Analysis, BackendAccount } from '@/lib/api-types';

const account: BackendAccount = {
  id: 'northstar',
  name: 'Northstar Labs',
  initials: 'NL',
  owner_id: 'aisha',
  plan: 'Scale',
  segment: 'Enterprise',
  industry: 'Analytics',
  arr_mrr: 8200,
  start_date: '2025-01-01',
  renewal_date: '2026-08-12',
};

const analysis: Analysis = {
  health: {
    adoption: 55,
    engagement: 65,
    experience: 35,
    financial: 100,
    value: 72,
    overall: 61,
    version: '1.0',
    generated_at: new Date().toISOString(),
  },
  risks: [
    {
      account_id: 'northstar',
      risk_type: 'cancellation',
      probability: 0.86,
      confidence: 0.8,
      top_features_json: [{ feature: 'tickets', value: 2 }],
      model_version: '1.0',
      generated_at: new Date().toISOString(),
    },
    {
      account_id: 'northstar',
      risk_type: 'payment_failure',
      probability: 0.2,
      confidence: 0.5,
      top_features_json: [],
      model_version: '1.0',
      generated_at: new Date().toISOString(),
    },
  ],
  causes: [{
    account_id: 'northstar',
    cause: 'technical_support',
    rank: 1,
    confidence: 0.76,
    evidence_json: [{ feature: 'high_severity', source: 'support' }],
    contradictions_json: [{ feature: 'payments_current', source: 'billing' }],
    rule_version: '1.0',
    generated_at: new Date().toISOString(),
    unknown_reason: null,
  }],
  actions: [
    {
      account_id: 'northstar',
      action_code: 'support_escalation',
      eligibility: true,
      rejection_reason: null,
      utility_score: 0.9,
      approval_required: true,
      approval_reason: 'Human review required',
      benefit: 'high',
      friction: 'medium',
      risk: 'low',
      generated_at: new Date().toISOString(),
    },
    {
      account_id: 'northstar',
      action_code: 'payment_retry',
      eligibility: false,
      rejection_reason: 'No payment-failure evidence',
      utility_score: null,
      approval_required: false,
      approval_reason: null,
      benefit: 'medium',
      friction: 'medium',
      risk: 'high',
      generated_at: new Date().toISOString(),
    },
  ],
};

describe('display mappings', () => {
  it('maps known and unknown action and cause codes safely', () => {
    expect(actionLabel('support_escalation')).toBe('Support escalation');
    expect(actionLabel('custom_action')).toBe('Custom Action');
    expect(causeToChurnType('technical-support')).toBe('Experience churn');
    expect(causeToChurnType('not_known')).toBe('Silent churn');
  });

  it.each([
    [90, 'Critical'], [80, 'Critical'], [79, 'High'], [60, 'High'],
    [59, 'Medium'], [40, 'Medium'], [39, 'Low'],
  ] as const)('maps risk %s to %s', (score, severity) => {
    expect(riskToSeverity(score)).toBe(severity);
  });

  it.each([[70, 'good'], [50, 'warning'], [49, 'critical']] as const)(
    'maps health %s to %s',
    (score, tone) => expect(scoreTone(score)).toBe(tone),
  );
});

describe('backend contract adapters', () => {
  it('adapts an account using the highest risk and ranked cause', () => {
    const result = adaptAccount(account, analysis);
    expect(result).toMatchObject({
      id: 'northstar',
      mrr: 'RM 8,200',
      risk: 86,
      severity: 'Critical',
      churnType: 'Experience churn',
      health: 61,
    });
  });

  it('returns safe pending values when analysis has not run', () => {
    expect(adaptAccount(account)).toMatchObject({
      risk: 0,
      severity: 'Low',
      health: 0,
      freshness: 'Analysis pending',
    });
  });

  it('builds the evidence-backed action profile and preserves rejection reasons', () => {
    const result = adaptChurnProfile(analysis, account);
    expect(result.probability).toBe(86);
    expect(result.causes[0].supporting[0].text).toContain('high-severity');
    expect(result.causes[0].contradicting[0].text).toBe('Payments are current');
    expect(result.action.recommended).toBe('Support escalation');
    expect(result.action.rejected).toEqual([
      { name: 'Payment retry & card update', reason: 'No payment-failure evidence' },
    ]);
  });

  it('uses no-action defaults when no recommendation is eligible', () => {
    const result = adaptChurnProfile({ ...analysis, risks: [], causes: [], actions: [] }, account);
    expect(result).toMatchObject({ probability: 0, churnType: 'Silent churn' });
    expect(result.action.recommended).toBe('No action');
  });

  it('adapts KPIs, trends, risk history, timeline, action mix, and audit logs', () => {
    expect(adaptKPIs({
      total_accounts: 50,
      at_risk_mrr: 48000,
      intervention_acceptance_rate: 0.724,
      override_rate: 0.136,
    })).toEqual({ totalAccounts: 50, atRiskMrr: 'RM 48,000', acceptanceRate: '72%', overrideRate: '14%' });

    expect(adaptTrend([{ month: '2026-07', mrr: 48550 }])).toEqual([{ month: 'Jul', mrr: 49 }]);
    expect(adaptActionMix([
      { name: 'support_escalation', eligible: 3, rejected: 1 },
      { name: 'payment_retry', eligible: 1, rejected: 3 },
      { name: 'no_action', eligible: 0, rejected: 0 },
    ])).toMatchObject({ totalEligible: 4, entries: [{ name: 'Support escalation', value: 75 }, { name: 'Payment retry & card update', value: 25 }] });

    const risks = analysis.risks;
    expect(adaptRiskHistory([{ date: '2026-07-20', risks }], 'cancellation')[0].risk).toBe(86);
    expect(adaptTimeline([
      { kind: 'support', title: 'Incident open', meta: 'critical', timestamp: 'now', raw: { severity: 'critical' } },
      { kind: 'payment', title: 'Invoice', meta: 'failed', timestamp: 'now', raw: { status: 'failed' } },
      { kind: 'feedback', title: 'CSAT', meta: 'negative', timestamp: 'now', raw: { sentiment: 'negative' } },
      { kind: 'usage', title: 'Login', meta: '1 event', timestamp: 'now' },
    ]).map((item) => item.tone)).toEqual(['critical', 'critical', 'warning', 'blue']);

    expect(adaptAuditLog({
      actor_id: 'aisha', actor_role: 'csm', action: 'approved', entity_type: 'intervention',
      entity_id: 'i-1', before_json: { status: 'pending' }, after_json: { status: 'approved' },
      timestamp: '2026-07-20T00:00:00Z', reason: null,
    })).toMatchObject({ actorId: 'aisha', entityId: 'i-1', after: { status: 'approved' } });
  });
});
