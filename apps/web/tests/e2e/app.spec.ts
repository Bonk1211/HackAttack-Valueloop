import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const pages = [
  ['/', 'Catch value loss before it becomes churn'],
  ['/risk-queue', 'Risk Queue'],
  ['/accounts', 'Accounts'],
  ['/accounts/northstar', 'Customer 360'],
  ['/approvals', 'Approval Inbox'],
  ['/outcomes', 'Outcomes'],
  ['/audit', 'Audit Log'],
  ['/data', 'Data ingestion'],
  ['/guided-demo', 'See the full value recovery loop'],
  ['/playbooks', 'Playbook Studio'],
] as const;

const envelope = (data: unknown) => ({
  data,
  meta: { request_id: 'browser-test', generated_at: '2026-07-20T00:00:00Z', version: 'v1' },
  errors: [],
});

async function fallbackApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (request.method() === 'POST' && path.endsWith('/interventions')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope({
      id: 'browser-intervention', account_id: 'northstar', recommended_action: 'support_escalation',
      final_action: null, approver: null, status: 'pending', channel: null, reason: null,
      created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:00:00Z',
    })) });
  }

  if (request.method() === 'PATCH' && path.endsWith('/interventions/browser-intervention')) {
    const body = request.postDataJSON() as { status: string; final_action?: string };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope({
      id: 'browser-intervention', account_id: 'northstar', recommended_action: 'support_escalation',
      final_action: body.final_action ?? null, approver: 'csm-demo', status: body.status,
      channel: null, reason: null, created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:01:00Z',
    })) });
  }

  if (request.method() === 'POST' && path.endsWith('/interventions/browser-intervention/outcome')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope({
      intervention_id: 'browser-intervention', renewed: null, downgraded: null, churned: null,
      usage_delta: 18, health_delta: 12, response: 'Incident resolved',
      observation: 'Observed over 14 days; no causal claim', recorded_at: '2026-07-20T00:02:00Z',
    })) });
  }

  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ...envelope(null), errors: [{ code: 503, message: 'Deterministic browser fallback' }] }),
  });
}

async function prepare(page: Page) {
  const runtimeErrors: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.route('**/api/v1/**', fallbackApi);
  return runtimeErrors;
}

test.describe('production route smoke tests', () => {
  for (const [path, heading] of pages) {
    test(`${path} renders its product screen without runtime errors`, async ({ page }) => {
      const runtimeErrors = await prepare(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      expect(runtimeErrors).toEqual([]);
    });
  }
});

test('critical pages have no serious accessibility violations', async ({ page }) => {
  await prepare(page);
  for (const path of ['/', '/accounts/northstar', '/approvals']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const material = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    expect(material, `${path}: ${material.map((violation) => `${violation.id}: ${violation.help}`).join(', ')}`).toEqual([]);
  }
});

test('keyboard users can skip navigation and open the tutorial', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('#main-content')).toBeVisible();
  await page.getByRole('button', { name: 'Page tutorial' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start with the page question' })).toBeVisible();
});

test('mobile layout avoids page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  for (const [path] of pages) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(dimensions.width, `${path} overflows at 390px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test('Northstar governed workflow requires approve before execute and outcome', async ({ page }) => {
  await prepare(page);
  await page.goto('/accounts/northstar');
  await page.getByRole('button', { name: 'Create intervention' }).click();
  await expect(page.getByText(/Intervention browser-int.*pending/i)).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Execute approved action' })).toBeVisible();
  await page.getByRole('button', { name: 'Execute approved action' }).click();
  await page.getByRole('textbox', { name: 'Observed customer response' }).fill('Incident resolved');
  await page.getByRole('button', { name: 'Record observed outcome' }).click();
  await expect(page.getByText(/Outcome recorded/i)).toBeVisible();
});

test('overview meets the three-second frontend budget after server warm-up', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  await page.reload();
  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return entry.domContentLoadedEventEnd - entry.startTime;
  });
  expect(navigation).toBeLessThan(3_000);
});
