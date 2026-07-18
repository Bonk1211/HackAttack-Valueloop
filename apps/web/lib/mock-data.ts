export type Severity = "Critical" | "High" | "Medium" | "Low";

export type ChurnType =
  | "Value churn"
  | "Experience churn"
  | "Product-fit churn"
  | "Price churn"
  | "Involuntary churn"
  | "Competitive churn"
  | "Lifecycle churn"
  | "Silent churn";

export type Account = {
  id: string;
  name: string;
  initials: string;
  owner: string;
  plan: string;
  segment: string;
  industry: string;
  mrr: string;
  risk: number;
  riskType: string;
  churnType?: ChurnType;
  severity: Severity;
  health: number;
  delta: number;
  renewal: string;
  freshness: string;
  action: string;
};

export type EvidenceItem = {
  text: string;
  source: string;
  timestamp: string;
};

export type CauseHypothesis = {
  label: string;
  confidence: number;
  strength: string;
  supporting: EvidenceItem[];
  contradicting: EvidenceItem[];
};

export type ActionPolicy = {
  recommended: string;
  description: string;
  benefit: "High" | "Medium" | "Low";
  friction: "High" | "Medium" | "Low";
  risk: "High" | "Medium" | "Low";
  approvalRequired: boolean;
  approvalReason: string;
  explanation: string;
  checks: string[];
  rejected: Array<{ name: string; reason: string }>;
};

export type ChurnProfile = {
  accountId: string;
  churnType: ChurnType;
  riskLabel: string;
  probability: number;
  riskDelta: number;
  summary: string;
  health: ReadonlyArray<readonly [string, number, number, "critical" | "warning" | "positive"]>;
  riskHistory: number[];
  causes: CauseHypothesis[];
  action: ActionPolicy;
  timeline: Array<{ tone: "critical" | "warning" | "positive" | "blue"; title: string; meta: string }>;
  outcome: { status: string; response: string; usageDelta: string; healthDelta: string; observation: string };
};

export const accounts: Account[] = [
  { id: "northstar", name: "Northstar Labs", initials: "NL", owner: "Aisha Rahman", plan: "Scale", segment: "Enterprise", industry: "B2B analytics", mrr: "RM 8,200", risk: 86, riskType: "Technical / Support", churnType: "Experience churn", severity: "Critical", health: 49, delta: -14, renewal: "12 Aug 2026", freshness: "8 min ago", action: "Support escalation" },
  { id: "harborline", name: "Harborline Ops", initials: "HO", owner: "Mei Tan", plan: "Growth", segment: "Growth", industry: "Logistics", mrr: "RM 4,800", risk: 74, riskType: "Value realization", churnType: "Value churn", severity: "High", health: 52, delta: -12, renewal: "03 Sep 2026", freshness: "16 min ago", action: "Guided onboarding" },
  { id: "forgeworks", name: "Forgeworks Studio", initials: "FS", owner: "Daniel Lee", plan: "Pro", segment: "Growth", industry: "Manufacturing", mrr: "RM 5,100", risk: 71, riskType: "Product Fit", churnType: "Product-fit churn", severity: "High", health: 55, delta: -10, renewal: "21 Sep 2026", freshness: "19 min ago", action: "Alternative workflow review" },
  { id: "lumen", name: "LumenWorks", initials: "LW", owner: "Mei Tan", plan: "Pro", segment: "Growth", industry: "Creative services", mrr: "RM 4,100", risk: 67, riskType: "Price / Plan Fit", churnType: "Price churn", severity: "High", health: 63, delta: -6, renewal: "19 Sep 2026", freshness: "32 min ago", action: "Flexible plan review" },
  { id: "ember", name: "Ember Commerce", initials: "EC", owner: "Daniel Lee", plan: "Pro", segment: "Growth", industry: "Commerce", mrr: "RM 5,600", risk: 79, riskType: "Payment", churnType: "Involuntary churn", severity: "High", health: 61, delta: -8, renewal: "28 Jul 2026", freshness: "14 min ago", action: "Payment retry & card update" },
  { id: "cobalt", name: "Cobalt Systems", initials: "CS", owner: "Aisha Rahman", plan: "Scale", segment: "Enterprise", industry: "Cybersecurity", mrr: "RM 9,100", risk: 76, riskType: "Competitive", churnType: "Competitive churn", severity: "High", health: 58, delta: -9, renewal: "11 Oct 2026", freshness: "22 min ago", action: "Differentiation review" },
  { id: "meridian", name: "Meridian Cloud", initials: "MC", owner: "Aisha Rahman", plan: "Scale", segment: "Enterprise", industry: "Cloud operations", mrr: "RM 7,900", risk: 68, riskType: "Lifecycle", churnType: "Lifecycle churn", severity: "High", health: 57, delta: -11, renewal: "04 Sep 2026", freshness: "21 min ago", action: "Pause subscription" },
  { id: "willow", name: "Willow Health", initials: "WH", owner: "Mei Tan", plan: "Team", segment: "Team", industry: "Health services", mrr: "RM 3,200", risk: 64, riskType: "Disengagement", churnType: "Silent churn", severity: "Medium", health: 60, delta: -7, renewal: "17 Oct 2026", freshness: "1 hr ago", action: "Early re-engagement" },
  { id: "atlas", name: "Atlas Robotics", initials: "AR", owner: "Daniel Lee", plan: "Scale", segment: "Enterprise", industry: "Robotics", mrr: "RM 9,400", risk: 22, riskType: "Expansion ready", severity: "Low", health: 88, delta: 9, renewal: "02 Nov 2026", freshness: "11 min ago", action: "Upgrade review" },
];

const sources = (product = "8 min ago", billing = "12 min ago", support = "6 min ago", feedback = "1 hr ago") => [
  ["Product usage", product], ["Billing", billing], ["Support", support], ["Feedback", feedback],
] as const;

export const sourceFreshness: Record<string, ReadonlyArray<readonly [string, string]>> = {
  northstar: sources(), harborline: sources("16 min ago", "18 min ago", "2 hr ago", "26 min ago"),
  forgeworks: sources("19 min ago", "22 min ago", "4 hr ago", "31 min ago"), lumen: sources("32 min ago", "15 min ago", "1 day ago", "44 min ago"),
  ember: sources("14 min ago", "4 min ago", "3 hr ago", "2 hr ago"), cobalt: sources("22 min ago", "18 min ago", "5 hr ago", "12 min ago"),
  meridian: sources("21 min ago", "13 min ago", "1 day ago", "2 hr ago"), willow: sources("1 hr ago", "18 min ago", "3 days ago", "4 hr ago"),
};

export const churnProfiles: ChurnProfile[] = [
  {
    accountId: "northstar", churnType: "Experience churn", riskLabel: "Cancellation", probability: 86, riskDelta: 11,
    summary: "Risk rose after two severe tickets remained unresolved while usage continued to decline.",
    health: [["Adoption", 38, -12, "critical"], ["Engagement", 44, -9, "warning"], ["Experience", 29, -18, "critical"], ["Financial", 91, 2, "positive"], ["Value", 51, -7, "warning"]],
    riskHistory: [58, 61, 64, 71, 75, 82, 86],
    causes: [
      { label: "Technical / Support", confidence: .86, strength: "Strong evidence", supporting: [{ text: "2 severe tickets remain unresolved", source: "Support", timestamp: "6 min ago" }, { text: "Resolution time increased 3.4 days", source: "Support", timestamp: "18 Jul" }, { text: "Usage fell 42% after the incident", source: "Product", timestamp: "8 min ago" }], contradicting: [{ text: "Payments remain current", source: "Billing", timestamp: "12 min ago" }, { text: "Admin still logs in weekly", source: "Product", timestamp: "14 Jul" }] },
      { label: "Disengagement", confidence: .58, strength: "Moderate evidence", supporting: [{ text: "Active days fell from 9 to 4", source: "Product", timestamp: "8 min ago" }], contradicting: [{ text: "Admin activity remains weekly", source: "Product", timestamp: "14 Jul" }] },
      { label: "Product Fit", confidence: .31, strength: "Weak evidence", supporting: [{ text: "One core workflow is under-used", source: "Product", timestamp: "18 Jul" }], contradicting: [{ text: "Goal completion was healthy before incident", source: "Success plan", timestamp: "01 Jul" }] },
    ],
    action: { recommended: "Support escalation", description: "Resolve the two high-severity tickets before customer outreach.", benefit: "High", friction: "Low", risk: "Low", approvalRequired: true, approvalReason: "A senior-support task needs an accountable owner and priority.", explanation: "Northstar Labs has two unresolved severe tickets and a 42% usage decline. Resolve the incident before retention outreach.", checks: ["Severe issue evidence present", "Owner and priority required", "Contact preference respected"], rejected: [{ name: "Payment recovery", reason: "No payment-failure evidence" }, { name: "Upgrade review", reason: "Experience score is below 70" }] },
    timeline: [{ tone: "critical", title: "Severity 1 ticket remains unresolved", meta: "Support · Today, 18:20" }, { tone: "warning", title: "Core workflow usage fell below baseline", meta: "Product · Today, 14:05" }, { tone: "positive", title: "Monthly payment succeeded", meta: "Billing · 17 Jul, 09:12" }, { tone: "blue", title: "Cancellation risk recalculated to 86%", meta: "Risk engine · 17 Jul, 08:30" }],
    outcome: { status: "Completed", response: "Incident resolved", usageDelta: "+18%", healthDelta: "+12", observation: "Observed over 14 days; no causal claim" },
  },
  {
    accountId: "harborline", churnType: "Value churn", riskLabel: "Value loss", probability: 74, riskDelta: 9,
    summary: "Time-to-first-value is above the segment baseline and four success goals remain incomplete.",
    health: [["Adoption", 31, -14, "critical"], ["Engagement", 47, -5, "warning"], ["Experience", 82, 3, "positive"], ["Financial", 88, 0, "positive"], ["Value", 28, -17, "critical"]], riskHistory: [42, 46, 51, 55, 62, 68, 74],
    causes: [
      { label: "Value Realization", confidence: .82, strength: "Strong evidence", supporting: [{ text: "Only 1 of 5 success goals completed", source: "Success plan", timestamp: "16 min ago" }, { text: "Time-to-first-value reached 18 days", source: "Product", timestamp: "16 min ago" }, { text: "Admin training is incomplete", source: "Enablement", timestamp: "26 min ago" }], contradicting: [{ text: "Customer satisfaction remains 8/10", source: "Feedback", timestamp: "26 min ago" }] },
      { label: "Product Fit", confidence: .55, strength: "Moderate evidence", supporting: [{ text: "Routing workflow adoption is 23%", source: "Product", timestamp: "16 min ago" }], contradicting: [{ text: "Required integrations are connected", source: "Product", timestamp: "12 Jul" }] },
      { label: "Disengagement", confidence: .41, strength: "Weak evidence", supporting: [{ text: "Training attendance is 1 of 3 sessions", source: "Enablement", timestamp: "15 Jul" }], contradicting: [{ text: "Weekly admin logins are stable", source: "Product", timestamp: "16 min ago" }] },
    ],
    action: { recommended: "Guided onboarding", description: "Run a goal-led onboarding session and targeted feature training.", benefit: "High", friction: "Medium", risk: "Low", approvalRequired: false, approvalReason: "Eligible for in-app education under the frequency cap.", explanation: "Harborline has not reached four agreed outcomes. Guide the team through the routing workflow before discussing plan changes.", checks: ["No severe support issue", "Education frequency cap available", "Training opt-out preserved"], rejected: [{ name: "Upgrade review", reason: "Value realization is too low" }, { name: "Payment retry", reason: "Billing is current" }] },
    timeline: [{ tone: "warning", title: "Fourth success goal missed its target date", meta: "Success plan · Today, 17:10" }, { tone: "warning", title: "Admin skipped second training session", meta: "Enablement · 17 Jul, 11:00" }, { tone: "positive", title: "All integrations connected", meta: "Product · 12 Jul, 15:42" }, { tone: "blue", title: "Value-loss risk recalculated to 74%", meta: "Risk engine · Today, 09:10" }],
    outcome: { status: "Scheduled", response: "Training accepted", usageDelta: "+9%", healthDelta: "+6", observation: "Simulated 14-day observation" },
  },
  {
    accountId: "forgeworks", churnType: "Product-fit churn", riskLabel: "Cancellation", probability: 71, riskDelta: 7,
    summary: "The team completed onboarding but still exports data to finish its core forecasting workflow elsewhere.",
    health: [["Adoption", 43, -8, "warning"], ["Engagement", 62, -2, "warning"], ["Experience", 75, 1, "positive"], ["Financial", 84, 0, "positive"], ["Value", 39, -13, "critical"]], riskHistory: [39, 43, 47, 54, 58, 64, 71],
    causes: [
      { label: "Product Fit", confidence: .84, strength: "Strong evidence", supporting: [{ text: "Forecasting workflow completed outside product", source: "Product", timestamp: "19 min ago" }, { text: "CSV exports increased 63%", source: "Product", timestamp: "19 min ago" }, { text: "Requested scenario feature is unavailable", source: "Feedback", timestamp: "31 min ago" }], contradicting: [{ text: "Onboarding completion is 100%", source: "Enablement", timestamp: "05 Jul" }, { text: "Support satisfaction is healthy", source: "Support", timestamp: "4 hr ago" }] },
      { label: "Value Realization", confidence: .49, strength: "Moderate evidence", supporting: [{ text: "Forecasting goal remains incomplete", source: "Success plan", timestamp: "18 Jul" }], contradicting: [{ text: "Reporting goal is complete", source: "Success plan", timestamp: "10 Jul" }] },
      { label: "Price / Plan Fit", confidence: .33, strength: "Weak evidence", supporting: [{ text: "Advanced tier feature remains unused", source: "Product", timestamp: "19 min ago" }], contradicting: [{ text: "No price objection recorded", source: "Feedback", timestamp: "31 min ago" }] },
    ],
    action: { recommended: "Alternative workflow review", description: "Map the confirmed need to a supported workflow or a transparent alternative.", benefit: "High", friction: "Medium", risk: "Medium", approvalRequired: true, approvalReason: "Product-fit guidance may change the customer plan or workflow.", explanation: "Forgeworks completed onboarding, but the core forecasting outcome still depends on external tools. Review supported alternatives without forcing retention.", checks: ["Customer requirement is documented", "Product feedback will be logged", "Downgrade and exit options remain visible"], rejected: [{ name: "More training", reason: "Onboarding is already complete" }, { name: "Upgrade review", reason: "Missing fit, not missing entitlement" }] },
    timeline: [{ tone: "warning", title: "Forecasting export volume increased 63%", meta: "Product · Today, 16:20" }, { tone: "critical", title: "Scenario-planning gap confirmed", meta: "Feedback · Today, 15:05" }, { tone: "positive", title: "Onboarding checklist completed", meta: "Enablement · 05 Jul" }, { tone: "blue", title: "Product-fit hypothesis ranked first", meta: "Rules · Today, 09:20" }],
    outcome: { status: "In review", response: "Workflow workshop booked", usageDelta: "+4%", healthDelta: "+3", observation: "Simulated; product gap remains open" },
  },
  {
    accountId: "lumen", churnType: "Price churn", riskLabel: "Downgrade", probability: 67, riskDelta: 6,
    summary: "Utilization is low relative to the subscribed tier and the renewal survey contains a direct price objection.",
    health: [["Adoption", 48, -4, "warning"], ["Engagement", 57, -3, "warning"], ["Experience", 79, 1, "positive"], ["Financial", 46, -15, "critical"], ["Value", 58, -5, "warning"]], riskHistory: [38, 42, 45, 49, 56, 61, 67],
    causes: [
      { label: "Price / Plan Fit", confidence: .81, strength: "Strong evidence", supporting: [{ text: "Only 24% of plan capacity is used", source: "Product", timestamp: "32 min ago" }, { text: "Renewal survey cites price pressure", source: "Feedback", timestamp: "44 min ago" }, { text: "Renewal quote increased 18%", source: "Billing", timestamp: "15 min ago" }], contradicting: [{ text: "Core workflow value remains high", source: "Success plan", timestamp: "16 Jul" }] },
      { label: "Product Fit", confidence: .47, strength: "Moderate evidence", supporting: [{ text: "Two advanced modules are unused", source: "Product", timestamp: "32 min ago" }], contradicting: [{ text: "Primary workflow is used weekly", source: "Product", timestamp: "32 min ago" }] },
      { label: "Disengagement", confidence: .29, strength: "Weak evidence", supporting: [{ text: "Seat activity declined 9%", source: "Product", timestamp: "32 min ago" }], contradicting: [{ text: "Admin sessions remain stable", source: "Product", timestamp: "32 min ago" }] },
    ],
    action: { recommended: "Flexible plan review", description: "Present a lower tier, usage-based option, pause, and direct cancellation path.", benefit: "High", friction: "Low", risk: "Low", approvalRequired: true, approvalReason: "A plan change requires customer choice and CSM confirmation.", explanation: "LumenWorks uses 24% of its current plan and has raised a price objection. Offer transparent lower-cost choices rather than an automatic discount.", checks: ["Price objection is explicit", "Lower tier and usage-based option shown", "Pause and cancellation remain available"], rejected: [{ name: "Automatic discount", reason: "Requires commercial approval and customer context" }, { name: "Upgrade review", reason: "Utilization is below current tier" }] },
    timeline: [{ tone: "critical", title: "Price objection recorded in renewal survey", meta: "Feedback · Today, 16:02" }, { tone: "warning", title: "Plan utilization measured at 24%", meta: "Product · Today, 15:40" }, { tone: "positive", title: "Primary workflow remains active", meta: "Product · Today, 11:20" }, { tone: "blue", title: "Downgrade risk recalculated to 67%", meta: "Risk engine · Today, 09:40" }],
    outcome: { status: "Approved", response: "Lower tier selected", usageDelta: "0%", healthDelta: "+4", observation: "Simulated downgrade; revenue impact recorded" },
  },
  {
    accountId: "ember", churnType: "Involuntary churn", riskLabel: "Payment failure", probability: 79, riskDelta: 14,
    summary: "Two failed attempts followed an expired card while product usage and satisfaction remained stable.",
    health: [["Adoption", 76, 1, "positive"], ["Engagement", 73, 2, "positive"], ["Experience", 81, 0, "positive"], ["Financial", 24, -26, "critical"], ["Value", 78, 2, "positive"]], riskHistory: [21, 22, 25, 33, 47, 65, 79],
    causes: [
      { label: "Payment", confidence: .91, strength: "Strong evidence", supporting: [{ text: "Card expired this month", source: "Billing", timestamp: "4 min ago" }, { text: "Two retry attempts failed", source: "Billing", timestamp: "4 min ago" }, { text: "Issuer returned expiry code", source: "Billing", timestamp: "4 min ago" }], contradicting: [{ text: "Product usage remains stable", source: "Product", timestamp: "14 min ago" }, { text: "No cancellation intent recorded", source: "Feedback", timestamp: "2 hr ago" }] },
      { label: "Technical / Support", confidence: .18, strength: "Weak evidence", supporting: [{ text: "One minor ticket opened", source: "Support", timestamp: "3 hr ago" }], contradicting: [{ text: "Ticket was resolved in 18 minutes", source: "Support", timestamp: "3 hr ago" }] },
      { label: "Disengagement", confidence: .12, strength: "Weak evidence", supporting: [{ text: "One seat inactive", source: "Product", timestamp: "14 min ago" }], contradicting: [{ text: "Active days are at baseline", source: "Product", timestamp: "14 min ago" }] },
    ],
    action: { recommended: "Payment retry & card update", description: "Send a secure card-update link and schedule a mock retry.", benefit: "High", friction: "Low", risk: "Medium", approvalRequired: true, approvalReason: "Finance policy controls retry timing; the demo never charges a real card.", explanation: "Ember has an expired card and two failed attempts without dissatisfaction signals. Treat this as involuntary churn, not a retention conversation.", checks: ["Payment-failure evidence present", "Retry is mock-only", "Secure hosted update path used"], rejected: [{ name: "Retention outreach", reason: "No dissatisfaction evidence" }, { name: "Plan downgrade", reason: "Usage and value remain healthy" }] },
    timeline: [{ tone: "critical", title: "Second payment attempt failed", meta: "Billing · Today, 18:02" }, { tone: "warning", title: "Card expiry confirmed", meta: "Billing · Today, 17:58" }, { tone: "positive", title: "Core workflow usage remains stable", meta: "Product · Today, 14:00" }, { tone: "blue", title: "Payment-failure risk recalculated to 79%", meta: "Risk engine · Today, 09:50" }],
    outcome: { status: "Completed", response: "Card updated", usageDelta: "0%", healthDelta: "+9", observation: "Simulated involuntary recovery" },
  },
  {
    accountId: "cobalt", churnType: "Competitive churn", riskLabel: "Cancellation", probability: 76, riskDelta: 10,
    summary: "A named competitor, a confirmed feature gap, and increased export activity indicate evaluation risk.",
    health: [["Adoption", 69, -2, "warning"], ["Engagement", 64, -5, "warning"], ["Experience", 72, -3, "warning"], ["Financial", 86, 0, "positive"], ["Value", 54, -11, "warning"]], riskHistory: [37, 41, 46, 52, 59, 66, 76],
    causes: [
      { label: "Competitive", confidence: .78, strength: "Strong evidence", supporting: [{ text: "Competitor named in executive feedback", source: "Feedback", timestamp: "12 min ago" }, { text: "Data exports increased 48%", source: "Product", timestamp: "22 min ago" }, { text: "Required policy feature is missing", source: "Product feedback", timestamp: "12 min ago" }], contradicting: [{ text: "Seven contract months remain", source: "Contract", timestamp: "18 Jul" }, { text: "Admin activity remains high", source: "Product", timestamp: "22 min ago" }] },
      { label: "Product Fit", confidence: .61, strength: "Moderate evidence", supporting: [{ text: "Policy simulation gap is confirmed", source: "Product feedback", timestamp: "12 min ago" }], contradicting: [{ text: "Four other workflows are healthy", source: "Product", timestamp: "22 min ago" }] },
      { label: "Price / Plan Fit", confidence: .22, strength: "Weak evidence", supporting: [{ text: "Competitor quote is lower", source: "Feedback", timestamp: "12 min ago" }], contradicting: [{ text: "No direct price objection recorded", source: "Feedback", timestamp: "12 min ago" }] },
    ],
    action: { recommended: "Differentiation review", description: "Compare confirmed requirements, product gaps, roadmap facts, and transparent contract options.", benefit: "Medium", friction: "Medium", risk: "Medium", approvalRequired: true, approvalReason: "Competitive positioning requires CSM and product-owner review.", explanation: "Cobalt is evaluating a named alternative because of a confirmed policy feature gap. Respond with verified differentiation and customer-friendly contract options.", checks: ["Competitor mention is customer-provided", "No disparagement or invented claims", "No coercive contract enforcement"], rejected: [{ name: "Automatic discount", reason: "Does not resolve the confirmed feature gap" }, { name: "Contract enforcement", reason: "Customer choice and fair terms take priority" }] },
    timeline: [{ tone: "critical", title: "Competitor evaluation disclosed", meta: "Feedback · Today, 17:50" }, { tone: "warning", title: "Data export volume increased 48%", meta: "Product · Today, 15:12" }, { tone: "positive", title: "Four core workflows remain healthy", meta: "Product · Today, 12:08" }, { tone: "blue", title: "Competitive hypothesis ranked first", meta: "Rules · Today, 10:05" }],
    outcome: { status: "In review", response: "Product session booked", usageDelta: "—", healthDelta: "+2", observation: "Simulated; no retention claim" },
  },
  {
    accountId: "meridian", churnType: "Lifecycle churn", riskLabel: "Inactivity", probability: 68, riskDelta: 8,
    summary: "The current project ended as planned and the customer has documented a return window in October.",
    health: [["Adoption", 52, -6, "warning"], ["Engagement", 34, -17, "critical"], ["Experience", 83, 1, "positive"], ["Financial", 89, 0, "positive"], ["Value", 63, -4, "warning"]], riskHistory: [32, 36, 41, 45, 51, 60, 68],
    causes: [
      { label: "Lifecycle", confidence: .88, strength: "Strong evidence", supporting: [{ text: "Implementation project closed on schedule", source: "Success plan", timestamp: "21 min ago" }, { text: "Return window documented for October", source: "Feedback", timestamp: "2 hr ago" }, { text: "Team activity stopped after project end", source: "Product", timestamp: "21 min ago" }], contradicting: [{ text: "No persistent negative experience", source: "Support", timestamp: "1 day ago" }, { text: "Payments remain current", source: "Billing", timestamp: "13 min ago" }] },
      { label: "Disengagement", confidence: .46, strength: "Moderate evidence", supporting: [{ text: "Active days fell to zero", source: "Product", timestamp: "21 min ago" }], contradicting: [{ text: "Inactivity matches planned project end", source: "Success plan", timestamp: "21 min ago" }] },
      { label: "Product Fit", confidence: .17, strength: "Weak evidence", supporting: [{ text: "No current workflow is active", source: "Product", timestamp: "21 min ago" }], contradicting: [{ text: "Previous project goals were completed", source: "Success plan", timestamp: "21 min ago" }] },
    ],
    action: { recommended: "Pause subscription", description: "Offer a transparent pause until the documented return window.", benefit: "High", friction: "Low", risk: "Low", approvalRequired: true, approvalReason: "A pause changes billing and requires explicit customer consent.", explanation: "Meridian completed its current project and expects to return in October. Offer a pause instead of pressuring continued use.", checks: ["Temporary lifecycle evidence present", "Customer consent required", "Export and cancellation paths remain available"], rejected: [{ name: "Usage campaign", reason: "Inactivity is planned, not accidental" }, { name: "Upgrade review", reason: "No active need during pause period" }] },
    timeline: [{ tone: "positive", title: "Implementation project completed", meta: "Success plan · 16 Jul" }, { tone: "warning", title: "Active team sessions reached zero", meta: "Product · Today, 14:12" }, { tone: "positive", title: "October return window confirmed", meta: "Feedback · Today, 11:05" }, { tone: "blue", title: "Lifecycle hypothesis ranked first", meta: "Rules · Today, 09:05" }],
    outcome: { status: "Approved", response: "Pause accepted", usageDelta: "—", healthDelta: "0", observation: "Simulated; resume date recorded" },
  },
  {
    accountId: "willow", churnType: "Silent churn", riskLabel: "Inactivity", probability: 64, riskDelta: 12,
    summary: "Usage has faded without complaints, support activity, payment failure, or an explicit cancellation signal.",
    health: [["Adoption", 46, -8, "warning"], ["Engagement", 27, -21, "critical"], ["Experience", 78, 0, "positive"], ["Financial", 92, 1, "positive"], ["Value", 49, -9, "warning"]], riskHistory: [25, 29, 31, 38, 45, 52, 64],
    causes: [
      { label: "Disengagement", confidence: .79, strength: "Strong evidence", supporting: [{ text: "Active days fell 61%", source: "Product", timestamp: "1 hr ago" }, { text: "Seven licensed seats are inactive", source: "Product", timestamp: "1 hr ago" }, { text: "No campaign response in 30 days", source: "Engagement", timestamp: "4 hr ago" }], contradicting: [{ text: "Payments remain current", source: "Billing", timestamp: "18 min ago" }, { text: "No negative ticket history", source: "Support", timestamp: "3 days ago" }] },
      { label: "Value Realization", confidence: .52, strength: "Moderate evidence", supporting: [{ text: "Two workflow goals have stalled", source: "Success plan", timestamp: "18 Jul" }], contradicting: [{ text: "Initial implementation goal was achieved", source: "Success plan", timestamp: "04 Jul" }] },
      { label: "Unknown", confidence: .28, strength: "Weak evidence", supporting: [{ text: "No direct reason has been supplied", source: "Feedback", timestamp: "4 hr ago" }], contradicting: [] },
    ],
    action: { recommended: "Early re-engagement", description: "Send one low-friction check-in focused on the stalled workflow.", benefit: "Medium", friction: "Low", risk: "Low", approvalRequired: true, approvalReason: "Customer-facing outreach requires CSM approval and contact preference.", explanation: "Willow still pays but usage has declined without a complaint or cancellation signal. Ask about the stalled workflow before assuming a cause.", checks: ["Contact preference allows outreach", "14-day frequency cap available", "Opt-out remains visible"], rejected: [{ name: "Payment recovery", reason: "Payments are healthy" }, { name: "Upgrade review", reason: "Engagement is declining" }] },
    timeline: [{ tone: "warning", title: "Seven licensed seats became inactive", meta: "Product · Today, 15:20" }, { tone: "warning", title: "Third campaign received no response", meta: "Engagement · Today, 12:00" }, { tone: "positive", title: "Monthly payment succeeded", meta: "Billing · Today, 09:30" }, { tone: "blue", title: "Silent-churn risk recalculated to 64%", meta: "Risk engine · Today, 09:10" }],
    outcome: { status: "Delivered", response: "Check-in opened", usageDelta: "+3%", healthDelta: "+2", observation: "Observed response; no causal claim" },
  },
];

export function getChurnProfile(accountId: string) {
  return churnProfiles.find((profile) => profile.accountId === accountId);
}

export const portfolioTrend = [
  { month: "Feb", mrr: 34 }, { month: "Mar", mrr: 38 }, { month: "Apr", mrr: 36 },
  { month: "May", mrr: 43 }, { month: "Jun", mrr: 45 }, { month: "Jul", mrr: 48 },
];

export const outcomeTrend = [
  { week: "W1", accepted: 7, overridden: 2 }, { week: "W2", accepted: 9, overridden: 3 },
  { week: "W3", accepted: 12, overridden: 2 }, { week: "W4", accepted: 15, overridden: 4 },
  { week: "W5", accepted: 18, overridden: 3 }, { week: "W6", accepted: 21, overridden: 4 },
];

export const actionMix = [
  { name: "Education", value: 18, fill: "#33483f" }, { name: "Service", value: 16, fill: "#6f8a6f" },
  { name: "Plan", value: 22, fill: "#8b7b65" }, { name: "Payment", value: 14, fill: "#b97a35" },
  { name: "Outreach", value: 20, fill: "#718078" }, { name: "Pause / no action", value: 10, fill: "#c9c7bf" },
];
