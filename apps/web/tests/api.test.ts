import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeAccount,
  createIntervention,
  getAccounts,
  getAudit,
  getInterventions,
  recordOutcome,
  transitionIntervention,
  uploadIngestionCsv,
} from '@/lib/api';

const ok = (data: unknown) => Promise.resolve(new Response(JSON.stringify({
  data,
  meta: { request_id: 'test', generated_at: '2026-07-20T00:00:00Z', version: 'v1' },
  errors: [],
}), { status: 200, headers: { 'Content-Type': 'application/json' } }));

describe('typed API client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => ok({}))));

  it('constructs query strings without dangling filters', async () => {
    await getAccounts(true);
    await getInterventions('pending', 'northstar');
    await getAudit({ entity_type: 'intervention', entity_id: 'i 1' });

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:8000/api/v1/accounts?include=analysis', expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:8000/api/v1/interventions?status=pending&account_id=northstar', expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(3, 'http://localhost:8000/api/v1/audit?entity_type=intervention&entity_id=i+1', expect.anything());
  });

  it('sends governed workflow mutations as JSON', async () => {
    await createIntervention({ account_id: 'northstar', recommended_action: 'support_escalation' });
    await transitionIntervention('i-1', { status: 'approved', reason: 'Evidence reviewed' });
    await recordOutcome('i-1', { usage_delta: 12, observation: 'Observed only' });
    await analyzeAccount('northstar');

    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/interventions'), expect.objectContaining({
      method: 'POST', body: JSON.stringify({ account_id: 'northstar', recommended_action: 'support_escalation' }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/interventions/i-1'), expect.objectContaining({ method: 'PATCH' }));
    expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('/interventions/i-1/outcome'), expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/accounts/northstar/analyze'), expect.objectContaining({ method: 'POST' }));
  });

  it('lets the browser set the multipart boundary for CSV uploads', async () => {
    const file = new File(['account_id,name\nnorthstar,Northstar Labs'], 'accounts.csv', { type: 'text/csv' });
    await uploadIngestionCsv(file);
    const options = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toEqual({});
  });

  it('surfaces HTTP and envelope errors without leaking response bodies', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('secret database detail', { status: 500, statusText: 'Internal Server Error' }));
    const error = await getAccounts().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('API 500: Internal Server Error');
    expect((error as Error).message).not.toContain('secret database detail');

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      data: null,
      errors: [{ code: 422, message: 'State transition is invalid' }],
    }), { status: 200 }));
    await expect(getAccounts()).rejects.toThrow('State transition is invalid');
  });
});
