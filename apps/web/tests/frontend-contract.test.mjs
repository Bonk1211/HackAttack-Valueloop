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
  assert.doesNotMatch(`${source}\n${fixtures}`, /fetch\(|axios|supabase/i);
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
