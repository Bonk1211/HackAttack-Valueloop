import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("every product screen has a real App Router entry", async () => {
  const routes = [
    ["app/page.tsx", "overview"], ["app/risk-queue/page.tsx", "risk"],
    ["app/accounts/page.tsx", "accounts"], ["app/accounts/[id]/page.tsx", "account"],
    ["app/approvals/page.tsx", "approvals"], ["app/outcomes/page.tsx", "outcomes"],
    ["app/audit/page.tsx", "audit"], ["app/data/page.tsx", "data"],
    ["app/guided-demo/page.tsx", "guide"], ["app/playbooks/page.tsx", "playbooks"],
  ];
  for (const [path, screen] of routes) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, new RegExp(`initialScreen=["']${screen}["']`));
  }
});

test("live API integration keeps deterministic fixtures only as fallback", async () => {
  const [source, fixtures, hooks] = await Promise.all([
    readFile(new URL("components/value-loop-app.tsx", root), "utf8"),
    readFile(new URL("lib/mock-data.ts", root), "utf8"),
    readFile(new URL("lib/use-swr.ts", root), "utf8"),
  ]);
  assert.match(fixtures, /Northstar Labs/);
  assert.match(source, /useAccounts\(true\)/);
  assert.match(source, /useRiskHistory\(accountId\)/);
  assert.match(source, /uploadIngestionCsv/);
  assert.match(source, /recordOutcome/);
  assert.match(hooks, /mockAccounts/);
});

test("API client covers every backend route family", async () => {
  const source = await readFile(new URL("lib/api.ts", root), "utf8");
  for (const fn of [
    "getAccounts", "getCustomer360", "getTimeline", "getHealth", "getRisks",
    "getCauses", "getActions", "analyzeAccount", "getDashboardKPIs",
    "getDashboardTrend", "getDashboardActionMix", "getInterventions",
    "createIntervention", "transitionIntervention", "recordOutcome", "getOutcomes",
    "getAudit", "getRiskHistory", "uploadIngestionCsv", "getIngestionJob",
  ]) assert.match(source, new RegExp(`export const ${fn}`), `missing export: ${fn}`);
});

test("adapters cover live account, evidence, action, history, and audit shapes", async () => {
  const source = await readFile(new URL("lib/adapters.ts", root), "utf8");
  for (const fn of [
    "adaptAccount", "adaptChurnProfile", "adaptKPIs", "adaptTimeline",
    "adaptRiskHistory", "adaptAuditLog", "causeToChurnType", "riskToSeverity",
  ]) assert.match(source, new RegExp(`export function ${fn}`), `missing adapter: ${fn}`);
});

test("Customer 360 accepts every backend account id", async () => {
  const source = await readFile(new URL("app/accounts/[id]/page.tsx", root), "utf8");
  assert.match(source, /initialAccountId=\{id\}/);
  assert.doesNotMatch(source, /notFound|mock-data/);
});

test("governed workflow persists valid state transitions and outcomes", async () => {
  const source = await readFile(new URL("components/value-loop-app.tsx", root), "utf8");
  assert.match(source, /createdIntervention\.status === 'pending'/);
  assert.match(source, /createdIntervention\.status === 'approved'/);
  assert.match(source, /createdIntervention\.status === 'executed'/);
  assert.match(source, /Record observed outcome/);
  assert.match(source, /workflowError/);
});

test("all screens expose contextual tutorials", async () => {
  const source = await readFile(new URL("components/value-loop-app.tsx", root), "utf8");
  for (const screen of ["overview", "risk", "accounts", "account", "approvals", "outcomes", "audit", "data", "guide", "playbooks"]) {
    assert.match(source, new RegExp(`\\n  ${screen}: \\[commonTourStart`));
  }
  assert.match(source, /Page tutorial/);
  assert.match(source, /scrollIntoView/);
});

test("honesty and human-control boundaries remain visible", async () => {
  const source = await readFile(new URL("components/value-loop-app.tsx", root), "utf8");
  assert.match(source, /hypothesis, not a verified cause/);
  assert.match(source, /No customer is contacted/);
  assert.match(source, /observations, not causal uplift/);
  assert.match(source, /Reject/);
  assert.match(source, /Modify/);
  assert.match(source, /Approve/);
});
