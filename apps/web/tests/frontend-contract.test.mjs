import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const routes = [
  ["app/page.tsx", "overview"],
  ["app/risk-queue/page.tsx", "risk"],
  ["app/accounts/page.tsx", "accounts"],
  ["app/accounts/[id]/page.tsx", "account"],
  ["app/approvals/page.tsx", "approvals"],
  ["app/outcomes/page.tsx", "outcomes"],
  ["app/audit/page.tsx", "audit"],
  ["app/guided-demo/page.tsx", "guide"],
  ["app/playbooks/page.tsx", "playbooks"],
];

test("every product screen has a real App Router entry", async () => {
  for (const [path, screen] of routes) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, new RegExp(`initialScreen=["']${screen}["']`));
  }
});

test("the frontend remains fixture-only", async () => {
  const [source, fixtures] = await Promise.all([
    readFile(new URL("components/value-loop-app.tsx", root), "utf8"),
    readFile(new URL("lib/mock-data.ts", root), "utf8"),
  ]);
  assert.match(fixtures, /Northstar Labs/);
  assert.match(source, /Rejected by policy/);
  // Only check the component and mock-data — api.ts intentionally uses fetch
  assert.doesNotMatch(`${source}\n${fixtures}`, /fetch\(|axios|supabase/i);
});

test("lib/api.ts exports the expected API client functions", async () => {
  const source = await readFile(new URL("lib/api.ts", root), "utf8");
  for (const fn of [
    "getAccounts", "getCustomer360", "getTimeline", "analyzeAccount",
    "getDashboardKPIs", "getDashboardTrend", "getDashboardActionMix",
    "getInterventions", "createIntervention", "transitionIntervention",
    "recordOutcome", "getOutcomes", "getAudit", "getRiskHistory",
  ]) {
    assert.match(source, new RegExp(`export const ${fn}`), `missing export: ${fn}`);
  }
});

test("lib/adapters.ts exports the expected adapter functions", async () => {
  const source = await readFile(new URL("lib/adapters.ts", root), "utf8");
  for (const fn of [
    "adaptAccount", "adaptChurnProfile", "adaptKPIs",
    "adaptTimeline", "adaptAuditLog", "causeToChurnType",
    "scoreTone", "riskToSeverity",
  ]) {
    assert.match(source, new RegExp(`export function ${fn}`), `missing export: ${fn}`);
  }
});

test("all eight churn pathways have evidence, an action, and an outcome", async () => {
  const fixtures = await readFile(new URL("lib/mock-data.ts", root), "utf8");
  const pathways = [
    "Value churn",
    "Experience churn",
    "Product-fit churn",
    "Price churn",
    "Involuntary churn",
    "Competitive churn",
    "Lifecycle churn",
    "Silent churn",
  ];
  const actions = [
    "Guided onboarding",
    "Support escalation",
    "Alternative workflow review",
    "Flexible plan review",
    "Payment retry & card update",
    "Differentiation review",
    "Pause subscription",
    "Early re-engagement",
  ];

  for (const pathway of pathways) assert.match(fixtures, new RegExp(`churnType: "${pathway}"`));
  for (const action of actions) assert.match(fixtures, new RegExp(`recommended: "${action.replaceAll("&", "\\&")}"`));
  assert.match(fixtures, /supporting: \[/);
  assert.match(fixtures, /contradicting: \[/);
  assert.equal((fixtures.match(/outcome: \{/g) ?? []).length, 9, "type definition plus eight seeded outcomes");
});

test("Customer 360 routes load the selected account fixture", async () => {
  const source = await readFile(new URL("app/accounts/[id]/page.tsx", root), "utf8");
  assert.match(source, /initialAccountId=\{id\}/);
  assert.match(source, /notFound\(\)/);
});

test("the Risk Queue offers an evidence-linked graph view", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("components/value-loop-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(source, /function ChurnIssueMap/);
  assert.match(source, /Account → pathway → leading issue/);
  assert.match(source, /Open evidence file/);
  assert.match(source, /aria-pressed=\{view === "graph"\}/);
  assert.match(styles, /\.issue-map-layout/);
  assert.match(styles, /\.cause-panel \{ background:#f3f2eb/);
});

test("motion stays accessible and fixture-safe", async () => {
  const [source, styles, manifest] = await Promise.all([
    readFile(new URL("components/value-loop-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(manifest, /"motion":/);
  assert.match(source, /from "motion\/react"/);
  assert.match(source, /useReducedMotion\(\)/);
  assert.match(source, /AnimatePresence/);
  assert.doesNotMatch(source, /addEventListener\(["']scroll/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
});

test("Customer 360 exposes the bounded agent decision and human checkpoint", async () => {
  const source = await readFile(new URL("components/value-loop-app.tsx", root), "utf8");
  for (const step of [
    "Customer data loaded",
    "Health and risks calculated",
    "Cause hypotheses generated",
    "Policy validation completed",
    "Recommendation generated",
    "Action execution",
    "Outcome measurement",
  ]) assert.match(source, new RegExp(step));
  assert.match(source, /decision-agent-v0\.1/);
  assert.match(source, /Eligible alternatives/);
  assert.match(source, /"Approve"/);
  assert.match(source, /<Menu \/>Modify/);
  assert.match(source, /<X \/>Reject/);
});

test("judges can follow the full governed loop without technical knowledge", async () => {
  const source = await readFile(new URL("components/value-loop-app.tsx", root), "utf8");
  for (const step of ["Detect", "Explain", "Decide", "Approve", "Act", "Measure"]) {
    assert.match(source, new RegExp(`\\[\\"${step}\\"`));
  }
  assert.match(source, /What the user does/);
  assert.match(source, /hypothesis, not a verified cause/);
  assert.match(source, /No customer is contacted/);
});

test("the no-code studio exposes safe customization boundaries", async () => {
  const source = await readFile(new URL("components/value-loop-app.tsx", root), "utf8");
  assert.match(source, /Minimum evidence confidence/);
  assert.match(source, /Maximum customer outreach/);
  assert.match(source, /Who approves sensitive actions/);
  assert.match(source, /Keep customer-choice paths visible/);
  assert.match(source, /What never becomes free-form/);
});

test("every screen exposes a contextual spotlight tutorial", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("components/value-loop-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(source, /const tourSteps: Record<Screen, TourStep\[]>/);
  for (const screen of ["overview", "risk", "accounts", "account", "approvals", "outcomes", "audit", "guide", "playbooks"]) {
    assert.match(source, new RegExp(`\\n  ${screen}: \\[commonTourStart`));
  }
  assert.match(source, /Page tutorial/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /event.key === "Escape"/);
  assert.match(styles, /\.tour-focus/);
  assert.match(styles, /100vmax/);
});
