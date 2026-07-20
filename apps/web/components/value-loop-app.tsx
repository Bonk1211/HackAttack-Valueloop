"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Pulse as Activity, WarningCircle as AlertCircle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  SealCheck as BadgeCheck, Bell, ClipboardText as BookOpenCheck, Check, CheckCircle as CheckCircle2,
  CaretDown as ChevronDown, CaretRight as ChevronRight, CurrencyDollar as CircleDollarSign,
  Clock as Clock3, Database, FileText as FileClock, Funnel as Filter, Gauge,
  SquaresFour as LayoutDashboard, Lifebuoy as LifeBuoy, List as Menu,
  DotsThree as MoreHorizontal, MagnifyingGlass as Search, ShieldCheck,
  HandPointing, MapTrifold, PlayCircle, SlidersHorizontal, Sparkle,
  Target, ThumbsUp, TrendDown as TrendingDown, TrendUp as TrendingUp,
  UserCircleCheck as UserRoundCheck, Users,
  X, XCircle,
} from "@phosphor-icons/react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { accounts, actionMix, churnProfiles, getChurnProfile, outcomeTrend, portfolioTrend, sourceFreshness, type Account, type Severity } from "@/lib/mock-data";
import {
  getCustomer360, createIntervention, transitionIntervention,
} from "@/lib/api";
import {
  adaptAccount, adaptChurnProfile, adaptTimeline, adaptAuditLog,
  type FrontendAuditLog,
} from "@/lib/adapters";
import {
  useAccounts, useCustomer360, useAnalysis, useTimeline, useKPIs,
  useInterventions, useOutcomes, useAudit,
} from "@/lib/use-swr";
import type { BackendAccount, Intervention } from "@/lib/api-types";

export type Screen = "overview" | "risk" | "accounts" | "account" | "approvals" | "outcomes" | "audit" | "guide" | "playbooks";

const nav = [
  ["overview", "Overview", LayoutDashboard], ["risk", "Risk Queue", Gauge], ["accounts", "Accounts", Users],
  ["approvals", "Approvals", BookOpenCheck], ["outcomes", "Outcomes", Target], ["audit", "Audit Log", FileClock],
] as const;
const exploreNav = [
  ["guide", "Guided demo", MapTrifold], ["playbooks", "Playbook Studio", SlidersHorizontal],
] as const;
const routes: Record<Screen, string> = {
  overview: "/",
  risk: "/risk-queue",
  accounts: "/accounts",
  account: "/accounts/northstar",
  approvals: "/approvals",
  outcomes: "/outcomes",
  audit: "/audit",
  guide: "/guided-demo",
  playbooks: "/playbooks",
};
const headings: Record<Screen, [string, string, string]> = {
  overview: ["Portfolio intelligence", "Catch value loss before it becomes churn", "Turn scattered customer signals into an explainable, policy-safe recovery workflow."],
  risk: ["Detect", "Risk Queue", "Prioritize accounts by urgency, revenue exposure, and evidence confidence."],
  accounts: ["Customer 360", "Accounts", "Find every customer, subscription, health profile, and latest intervention."],
  account: ["Account / Northstar Labs", "Customer 360", "Unified value, risk, evidence, decisions, and activity for one account."],
  approvals: ["Approve", "Approval Inbox", "Review sensitive actions with complete account and policy context."],
  outcomes: ["Measure", "Outcomes", "Track observed results without implying causal uplift."],
  audit: ["Governance", "Audit Log", "Trace every recommendation, override, approval, and state change."],
  guide: ["Judge walkthrough", "See the full value recovery loop", "Follow one customer from fragmented signals to a measured, human-approved outcome."],
  playbooks: ["No-code configuration", "Playbook Studio", "Adapt signals, decision rules, approvals, and outcomes in plain business language."],
};

const churnTabs = ["All", "Urgent", "Value", "Experience", "Product-fit", "Price", "Involuntary", "Competitive", "Lifecycle", "Silent"];
const riskDays = ["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul", "17 Jul", "18 Jul"];
const getAccount = (accountId: string) => accounts.find((account) => account.id === accountId) ?? accounts[0];
const timelineIcons = { critical: AlertCircle, warning: TrendingDown, positive: CheckCircle2, blue: Activity } as const;
const spring = { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.8 };

type TourStep = { selector: string; title: string; detail: string };
const commonTourStart: TourStep = { selector: ".page-head", title: "Start with the page question", detail: "This heading tells you the decision this screen helps you make. You do not need to understand the underlying models to use the workflow." };
const tourSteps: Record<Screen, TourStep[]> = {
  overview: [commonTourStart, { selector: ".problem-bridge", title: "See the whole solution first", detail: "This connects the fragmented-data problem to ValueLoop's six governed decisions." }, { selector: ".kpi-grid", title: "Scan portfolio urgency", detail: "These indicators show revenue exposure, urgent accounts, action acceptance, and data freshness." }, { selector: ".overview-grid .table-card", title: "Choose the account that needs attention", detail: "Accounts are prioritized by risk, value exposure, renewal timing, and evidence, not by one hidden score." }, { selector: ".overview-grid .insight", title: "Read the evidence pass", detail: "The selected account shows risk, likely hypotheses, direct evidence, a safe response, and a rejected alternative." }],
  risk: [commonTourStart, { selector: ".queue-tools", title: "Narrow the queue", detail: "Use pathway tabs, search, and the graph/table switch to match the way your team investigates risk." }, { selector: ".issue-map", title: "Follow the risk route", detail: "Each row connects an account to its churn pathway and leading issue so the reasoning stays visible." }, { selector: ".map-inspector", title: "Inspect before opening the account", detail: "The inspector summarizes the strongest signal, contradiction, and policy-safe response." }],
  accounts: [commonTourStart, { selector: ".mini-kpis", title: "Understand portfolio coverage", detail: "These figures summarize managed accounts, recurring revenue, profile completeness, and source freshness." }, { selector: ".queue-tools", title: "Find the right customer", detail: "Search by account or use segment and health views without entering a technical query." }, { selector: ".data-table", title: "Compare accounts consistently", detail: "Every row uses the same health, renewal, pathway, and next-action fields." }],
  account: [commonTourStart, { selector: ".profile-side", title: "Confirm who and what the data represents", detail: "The profile keeps plan, value, owner, contact permission, and source freshness next to the analysis." }, { selector: ".risk-chart-card", title: "Detect what changed", detail: "Risk types stay separate and the summary explains the movement in plain language." }, { selector: ".health-grid", title: "Look beyond one score", detail: "Adoption, engagement, experience, financial, and value health reveal which part of the relationship weakened." }, { selector: ".agent-run", title: "Follow the bounded agent", detail: "See which deterministic checks are complete, where human review pauses the run, and which model and policy versions produced the recommendation." }, { selector: ".cause-panel", title: "Challenge the explanation", detail: "Choose a hypothesis and compare supporting evidence with contradictory evidence. These are hypotheses, never verified causes." }, { selector: ".action-card", title: "Keep the final choice human", detail: "Review confidence, eligible alternatives, rejected actions, then approve, modify, or reject the mock recommendation." }, { selector: ".timeline", title: "Reconstruct the customer story", detail: "Usage, billing, support, feedback, decisions, and outcomes share one timestamped history." }],
  approvals: [commonTourStart, { selector: ".approval-list", title: "Work through governed requests", detail: "Sensitive recommendations wait here for a named human reviewer." }, { selector: ".approval-detail", title: "Review the complete decision context", detail: "The reviewer sees customer context, freshness, policy checks, and a deterministic explanation before deciding." }, { selector: ".approval-actions", title: "Keep the final choice human", detail: "Approve, modify, or reject. Changes require an accountable decision rather than silent automation." }],
  outcomes: [commonTourStart, { selector: ".kpi-grid", title: "Measure the workflow", detail: "Acceptance, overrides, time to action, and observed health movement show whether the operating process works." }, { selector: ".chart-grid", title: "Separate activity from proof", detail: "Charts and recovery summaries are labelled observed or simulated and do not claim causal uplift." }, { selector: ".queue-card", title: "Compare every pathway outcome", detail: "The table shows the final action, response, usage movement, health movement, and observation window." }],
  audit: [commonTourStart, { selector: ".queue-tools", title: "Filter the history", detail: "Find decisions, approvals, data events, actors, or entities without reading raw system logs." }, { selector: ".data-table", title: "Trace every governed event", detail: "Each event keeps its actor, account, action, entity, time, and policy version." }, { selector: ".audit-diff", title: "See exactly what changed", detail: "The readable before-and-after record makes overrides and recommendations reviewable." }],
  guide: [commonTourStart, { selector: ".guide-brief", title: "Connect the problem to the response", detail: "The walkthrough begins with the manual investigation problem, then shows the governed recovery loop." }, { selector: ".scenario-bar", title: "Try a different customer situation", detail: "Switch among all eight seeded churn pathways and the tutorial updates the complete story." }, { selector: ".walkthrough-nav", title: "Move through six decisions", detail: "Select Detect, Explain, Decide, Approve, Act, or Measure at any time." }, { selector: ".walkthrough-result", title: "See what ValueLoop and the user each do", detail: "Every step shows the system result, its honesty boundary, and the next human responsibility." }],
  playbooks: [commonTourStart, { selector: ".studio-intro", title: "Configure in business language", detail: "Operators start with a customer situation instead of code, model parameters, or database rules." }, { selector: ".studio-form", title: "Build the playbook step by step", detail: "Choose a pathway, describe the intent, then set understandable confidence, frequency, approval, and customer-choice guardrails." }, { selector: ".playbook-preview", title: "Review the rule before testing", detail: "The live IF / THEN / ONLY WHEN preview exposes eligibility, approvals, rejected actions, and outcomes." }, { selector: ".customization-boundary", title: "Know what cannot be weakened", detail: "Evidence provenance, consent, policy checks, audit records, and real-world execution boundaries remain controlled." }],
};

function cx(...items: Array<string | false | undefined>) { return items.filter(Boolean).join(" "); }
function RevealSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.section className={className} initial={reduce ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={reduce ? { duration: 0 } : { ...spring, delay }}>{children}</motion.section>;
}

/** Non-blocking loading indicator — a subtle bar at the top of the content area. */
function LoadingBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="loading-bar" role="status" aria-live="polite" aria-label="Loading data">
      <motion.div
        className="loading-bar-track"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "left" }}
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Small inline toast shown when API is unreachable and mock data is being used. */
function FallbackBanner({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  if (!show) return null;
  return (
    <motion.div
      className="fallback-banner"
      role="status"
      aria-live="polite"
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : spring}
    >
      <AlertCircle />
      <span>Using demo data — API unreachable</span>
    </motion.div>
  );
}
function Avatar({ account, small }: { account: Account; small?: boolean }) { return <span aria-label={`${account.name} monogram`} className={cx("avatar", small && "avatar-sm")}>[{account.initials}]</span>; }
function Delta({ value, points }: { value: number; points?: boolean }) {
  return <span className={cx("delta", value >= 0 ? "up" : "down")}>{value >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{Math.abs(value)}{points ? " pts" : "%"}</span>;
}
function Badge({ severity, risk }: { severity: Severity; risk?: number }) { return <span className={`badge badge-${severity.toLowerCase()}`}><i />{risk !== undefined && `${risk}% `}{severity}</span>; }
function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <motion.div className="section-title" initial={reduce ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }} transition={reduce ? { duration: 0 } : { ...spring, stiffness: 300 }}><div><span>{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</motion.div>;
}

function PageTour({ screen, onClose }: { screen: Screen; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const steps = tourSteps[screen];
  const step = steps[index];

  useEffect(() => {
    let frame = 0;
    let settleFrame = 0;
    let settleFramesRemaining = 8;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(step.selector);
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({ width, height });
      if (!target) { setBox(null); return; }
      const rect = target.getBoundingClientRect();
      const margin = 12;
      const padding = 7;
      const left = Math.max(margin, rect.left - padding);
      const top = Math.max(margin, rect.top - padding);
      const visibleWidth = Math.max(0, Math.min(width - margin, rect.right + padding) - left);
      const availableHeight = Math.max(0, Math.min(height - margin, rect.bottom + padding) - top);
      const measuredCardHeight = cardHeight || (width <= 680 ? 320 : 280);
      const roomForCardBelow = height - top - measuredCardHeight - 34;
      const roomForCardAbove = top - measuredCardHeight - 34;
      const preferredFocusHeight = Math.min(520, height * (width <= 680 ? 0.42 : 0.56));
      const maxFocusHeight = roomForCardAbove >= margin ? preferredFocusHeight : Math.min(preferredFocusHeight, Math.max(120, roomForCardBelow));
      setBox({ top, left, width: visibleWidth, height: Math.min(availableHeight, maxFocusHeight) });
    };
    const target = document.querySelector<HTMLElement>(step.selector);
    if (target) {
      const targetHeight = target.getBoundingClientRect().height;
      target.scrollIntoView({ block: targetHeight > window.innerHeight * 0.56 ? "start" : "center", behavior: "instant" as ScrollBehavior });
    }
    const measureWhileSettling = () => {
      measure();
      settleFramesRemaining -= 1;
      if (settleFramesRemaining > 0) settleFrame = window.requestAnimationFrame(measureWhileSettling);
    };
    frame = window.requestAnimationFrame(measureWhileSettling);
    window.addEventListener("resize", measure);
    const observer = target ? new ResizeObserver(measure) : null;
    if (target && observer) observer.observe(target);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [step.selector, reduce, cardHeight]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const updateCardHeight = () => setCardHeight(cardRef.current?.getBoundingClientRect().height ?? 0);
    updateCardHeight();
    const observer = new ResizeObserver(updateCardHeight);
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [screen, index]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(steps.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, steps.length]);

  const cardWidth = Math.min(370, Math.max(280, viewport.width - 32));
  const cardLeft = box ? Math.max(16, Math.min(box.left, viewport.width - cardWidth - 16)) : Math.max(16, (viewport.width - cardWidth) / 2);
  const measuredCardHeight = cardHeight || 280;
  const belowTop = box ? box.top + box.height + 18 : 16;
  const aboveTop = box ? box.top - measuredCardHeight - 18 : 16;
  const fitsBelow = belowTop + measuredCardHeight <= viewport.height - 16;
  const fitsAbove = aboveTop >= 16;
  const cardTop = box
    ? fitsBelow ? belowTop : fitsAbove ? aboveTop : Math.max(16, viewport.height - measuredCardHeight - 16)
    : Math.max(16, (viewport.height - measuredCardHeight) / 2);

  return <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-detail">
    <button className="tour-click-shield" aria-label="Close page tutorial" onClick={onClose} />
    {box && <><motion.div className="tour-focus" initial={reduce ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0 } : spring} style={box} /><motion.span className="tour-pointer" initial={reduce ? false : { opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} style={{ top: Math.max(10, box.top - 14), left: Math.max(10, box.left - 14) }}><HandPointing /></motion.span></>}
    <motion.article ref={cardRef} key={`${screen}-${index}`} className="tour-card" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : spring} style={{ width: cardWidth, top: cardTop, left: cardLeft }}>
      <header><span>Page tutorial · {index + 1} of {steps.length}</span><button aria-label="Close tutorial" onClick={onClose}><X /></button></header><h2 id="tour-title">{step.title}</h2><p id="tour-detail">{step.detail}</p><div className="tour-progress" aria-label={`Tutorial progress: step ${index + 1} of ${steps.length}`}>{steps.map((item, stepIndex) => <i className={stepIndex === index ? "active" : stepIndex < index ? "complete" : ""} key={item.title} />)}</div><footer><button className="text-btn" onClick={onClose}>Skip tutorial</button><div><button className="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Back</button><button className="primary" onClick={() => index === steps.length - 1 ? onClose() : setIndex(index + 1)}>{index === steps.length - 1 ? "Finish" : "Next"}<ArrowRight /></button></div></footer>
    </motion.article>
  </div>;
}
function Kpi({ label, value, delta, note, icon: Icon, tone, index = 0 }: { label: string; value: string; delta: number; note: string; icon: typeof Activity; tone: string; index?: number }) {
  const reduce = useReducedMotion();
  return <motion.article className="card kpi" initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.45 }} transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.055 }} whileHover={reduce ? undefined : { y: -3 }} whileTap={reduce ? undefined : { scale: 0.99 }}><span className={`kpi-icon ${tone}`}><Icon /></span><div><small>{label}</small><div><strong>{value}</strong><Delta value={delta} /></div><p>{note}</p></div><motion.button whileTap={reduce ? undefined : { scale: 0.9 }} className="icon-btn" aria-label={`More ${label} options`}><MoreHorizontal /></motion.button></motion.article>;
}

function AccountTable({ rows, selected, onSelect, compact }: { rows: Account[]; selected?: string; onSelect: (a: Account) => void; compact?: boolean }) {
  if (!rows.length) return <div className="empty"><Search /><strong>No matching accounts</strong><span>Try changing the active filters.</span></div>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Account</th><th>MRR</th><th>Churn pathway</th>{!compact && <th>Health</th>}<th>Renewal</th>{!compact && <th>Next action</th>}<th /></tr></thead><tbody>{rows.map(a => <tr key={a.id} className={selected === a.id ? "selected" : ""} onClick={() => onSelect(a)}><td><div className="account-cell"><Avatar account={a} small /><span><strong>{a.name}</strong><small>{a.owner}</small></span></div></td><td><strong>{a.mrr}</strong></td><td><div className="risk-cell"><span>{a.churnType ?? "Expansion ready"}</span><small>{a.riskType}</small><Badge severity={a.severity} risk={a.risk} /></div></td>{!compact && <td><div className="health-cell"><strong>{a.health}</strong><Delta value={a.delta} points /></div></td>}<td><span>{a.renewal}</span><small>{a.freshness}</small></td>{!compact && <td><span className="action-pill">{a.action}</span></td>}<td><button className="row-btn" aria-label={`Open ${a.name}`}><ChevronRight /></button></td></tr>)}</tbody></table></div>;
}

function ChurnIssueMap({ rows, openAccount }: { rows: Account[]; openAccount: (accountId: string) => void }) {
  const mapped = rows.flatMap((account) => { const profile = getChurnProfile(account.id); return profile ? [{ account, profile }] : []; });
  const [selectedId, setSelectedId] = useState(mapped[0]?.account.id ?? "northstar");
  const reduce = useReducedMotion();
  if (!mapped.length) return <div className="empty"><Search /><strong>No mapped churn issues</strong><span>Try changing the active filters.</span></div>;
  const selected = mapped.find(({ account }) => account.id === selectedId) ?? mapped[0];
  return <section className="issue-map" aria-label="Churn issue map">
    <header><div><span>Signal map</span><h3>Account → pathway → leading issue</h3><p>Select a route to inspect its evidence and policy-safe response.</p></div><div className="map-legend"><span><i className="critical" />Critical</span><span><i className="high" />High</span><span><i className="medium" />Medium</span></div></header>
    <div className="issue-map-layout"><div className="issue-routes">{mapped.map(({ account, profile }, index) => <motion.button initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: Math.min(index * 0.035, 0.24) }} whileHover={reduce ? undefined : { x: 3 }} whileTap={reduce ? undefined : { scale: 0.995 }} aria-pressed={selected.account.id === account.id} className={selected.account.id === account.id ? "active" : ""} onClick={() => setSelectedId(account.id)} key={account.id}>
      <span className="route-index">{String(index + 1).padStart(2, "0")}</span><span className="map-node account-node"><Avatar account={account} small /><span><strong>{account.name}</strong><small>{account.mrr} MRR</small></span></span><span className="map-link"><i /><em>{profile.probability}% risk</em></span><span className="map-node pathway-node"><small>Pathway</small><strong>{profile.churnType}</strong></span><span className="map-link"><i /><em>{profile.causes[0].confidence.toFixed(2)}</em></span><span className="map-node issue-node"><small>Leading issue</small><strong>{profile.causes[0].label}</strong></span><ChevronRight />
    </motion.button>)}</div>
    <AnimatePresence mode="wait" initial={false}><motion.aside key={selected.account.id} className="map-inspector" initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -8 }} transition={reduce ? { duration: 0 } : spring}><span>Selected route · {selected.profile.churnType}</span><h3>{selected.account.name}</h3><p>{selected.profile.summary}</p><dl><div><dt>Leading issue</dt><dd>{selected.profile.causes[0].label} · {selected.profile.causes[0].confidence.toFixed(2)}</dd></div><div><dt>Strongest signal</dt><dd>{selected.profile.causes[0].supporting[0].text}</dd></div><div><dt>Contradiction</dt><dd>{selected.profile.causes[0].contradicting[0]?.text ?? "None recorded"}</dd></div><div><dt>Safe response</dt><dd>{selected.profile.action.recommended}</dd></div></dl><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={spring} className="primary full" onClick={() => openAccount(selected.account.id)}>Open evidence file <ArrowRight /></motion.button><small>Hypothesis only · rule cause-v1.5</small></motion.aside></AnimatePresence></div>
  </section>;
}

function Overview({ openAccount, openRisk, openGuide, openPlaybooks }: { openAccount: (accountId: string) => void; openRisk: () => void; openGuide: () => void; openPlaybooks: () => void }) {
  const reduce = useReducedMotion();

  // Fetch live KPIs (falls back to mock on error)
  const { data: kpis, loading: kpiLoading, usingFallback: kpiFallback } = useKPIs();

  // Fetch accounts with analysis (falls back to mock on error)
  const { data: apiAccounts, loading: accountsLoading, usingFallback: accountsFallback } = useAccounts(true);

  // Top 5 accounts sorted by risk (descending)
  const topAccounts = useMemo(
    () => [...apiAccounts].sort((a, b) => b.risk - a.risk).slice(0, 5),
    [apiAccounts],
  );

  // High-risk count derived from the live/mock account list
  const highRiskCount = useMemo(
    () => apiAccounts.filter((a) => a.risk >= 60).length,
    [apiAccounts],
  );

  const [selected, setSelected] = useState(topAccounts[0] ?? accounts[0]);
  // Keep selected in sync when topAccounts change
  useEffect(() => {
    if (topAccounts.length && !topAccounts.find((a) => a.id === selected.id)) {
      setSelected(topAccounts[0]);
    }
  }, [topAccounts, selected.id]);

  const selectedProfile = getChurnProfile(selected.id) ?? churnProfiles[0];
  const showFallback = kpiFallback || accountsFallback;

  return <>
    <FallbackBanner show={showFallback} />
    <LoadingBar active={kpiLoading || accountsLoading} />
    <RevealSection className="problem-bridge">
      <div className="problem-copy"><span>Why ValueLoop exists</span><h2>One customer problem. Six connected decisions.</h2><p>CSMs should not have to compare product analytics, billing, support, and CRM notes by hand. ValueLoop assembles the evidence, explains uncertainty, filters unsafe actions, keeps a human in control, and records what happened next.</p><div><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="primary" onClick={openGuide}><PlayCircle />Start the 3-minute walkthrough</motion.button><button className="text-btn" onClick={openPlaybooks}>See how teams customize it <ArrowRight /></button></div></div>
      <div className="loop-strip" aria-label="ValueLoop governed workflow">{["Detect", "Explain", "Decide", "Approve", "Act", "Measure"].map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong><small>{["Unify warning signs", "Show evidence", "Choose safely", "Keep control", "Log the response", "Observe change"][index]}</small>{index < 5 && <ArrowRight />}</div>)}</div>
    </RevealSection>
    <section className="kpi-grid">
      <Kpi index={0} label="At-risk MRR" value={kpis.atRiskMrr} delta={12.4} note="Across eight churn pathways" icon={CircleDollarSign} tone="blue" />
      <Kpi index={1} label="High-risk accounts" value={String(highRiskCount)} delta={3} note="Seven require governed review" icon={AlertCircle} tone="amber" />
      <Kpi index={2} label="Action acceptance" value={kpis.acceptanceRate} delta={8.1} note="Last 30 days" icon={ThumbsUp} tone="green" />
      <Kpi index={3} label="Data freshness" value="98.2%" delta={1.3} note="All core sources healthy" icon={Database} tone="violet" />
    </section>
    <RevealSection className="overview-grid" delay={0.05}>
      <article className="card table-card"><SectionTitle eyebrow="Priority queue" title="Accounts needing attention" action={<motion.button whileHover={reduce ? undefined : { x: 3 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="text-btn" onClick={openRisk}>View risk queue <ArrowRight /></motion.button>} /><AccountTable rows={topAccounts} selected={selected.id} onSelect={setSelected} compact /></article>
      <AnimatePresence mode="wait" initial={false}><motion.aside key={selected.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={reduce ? { duration: 0 } : { duration: 0.18 }} className="insight" aria-label={`Selected insight for ${selected.name}`}>
        <header className="ticket-head"><div className="insight-label"><span>{selectedProfile.churnType}</span><span>Case {String(churnProfiles.indexOf(selectedProfile) + 1).padStart(3, "0")}</span></div><div className="insight-account"><Avatar account={selected} /><span><strong>{selected.name}</strong><small>{selected.plan} · {selected.mrr} MRR</small></span></div></header>
        <div className="insight-risk"><div><span>{selectedProfile.riskLabel} risk</span><Badge severity={selected.severity} /></div><strong>{selectedProfile.probability}<small>%</small></strong></div>
        <div className="hypotheses"><small>Likely causes</small>{selectedProfile.causes.slice(0, 2).map((hypothesis) => <div className="ticket-hypothesis" key={hypothesis.label}><span>{hypothesis.label}</span><b>{hypothesis.confidence.toFixed(2)}</b><i><b style={{ width: `${hypothesis.confidence * 100}%` }} /></i></div>)}</div>
        <ul>{selectedProfile.causes[0].supporting.slice(0, 3).map((evidence) => <li key={evidence.text}><Activity />{evidence.text}</li>)}</ul>
        <div className="ticket-stub"><div className="insight-action"><small>Admit one next action</small><strong>{selectedProfile.action.recommended}</strong><span>{selectedProfile.action.rejected[0].name} rejected · {selectedProfile.action.rejected[0].reason}</span></div><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={spring} className="primary light" onClick={() => openAccount(selected.id)}>Open Customer 360 <ArrowRight /></motion.button><code aria-hidden="true">VL-{selected.renewal.slice(0, 2)}-{selected.initials}</code></div>
      </motion.aside></AnimatePresence>
    </RevealSection>
    <RevealSection className="chart-grid" delay={0.08}>
      <article className="card chart-card wide"><SectionTitle eyebrow="Portfolio movement" title="At-risk MRR trend" detail="RM 48.0k is currently exposed across the eight seeded pathways." action={<button className="period">Last 6 months <ChevronDown /></button>} /><div className="chart"><ResponsiveContainer><AreaChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -20 }}><CartesianGrid vertical={false} stroke="#e8e8e3" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} /><Tooltip /><Area dataKey="mrr" name="At-risk MRR (RM k)" stroke="#33483f" strokeWidth={2.5} fill="#e8eee9" /></AreaChart></ResponsiveContainer></div></article>
      <article className="card chart-card"><SectionTitle eyebrow="Recommendations" title="Action mix" detail="Safe, eligible actions this month." /><div className="donut"><div className="donut-chart"><ResponsiveContainer><PieChart><Pie data={actionMix} dataKey="value" innerRadius={46} outerRadius={70} paddingAngle={3}>{actionMix.map(x => <Cell key={x.name} fill={x.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><span><strong>50</strong><small>actions</small></span></div><div className="legend">{actionMix.map(x => <div key={x.name}><i style={{ background: x.fill }} /><span>{x.name}</span><strong>{x.value}%</strong></div>)}</div></div></article>
    </RevealSection>
  </>;
}

const walkthroughSteps = [
  ["Detect", "Find the change", "Combine customer signals before the risk is obvious."],
  ["Explain", "Build an evidence file", "Rank hypotheses and show what argues against each one."],
  ["Decide", "Filter the choices", "Reject actions that do not fit the evidence or customer state."],
  ["Approve", "Keep a human in control", "Route sensitive actions to the right owner with full context."],
  ["Act", "Record the response", "Simulate or log the action without hidden automation."],
  ["Measure", "Observe what changed", "Track later movement without claiming unproven causality."],
] as const;

function GuidedDemo({ openAccount, openApprovals, openOutcomes, openPlaybooks }: { openAccount: (accountId: string) => void; openApprovals: () => void; openOutcomes: () => void; openPlaybooks: () => void }) {
  const [step, setStep] = useState(0);
  const [accountId, setAccountId] = useState("northstar");
  const reduce = useReducedMotion();
  const account = getAccount(accountId);
  const profile = getChurnProfile(account.id) ?? churnProfiles[0];
  const cause = profile.causes[0];
  const outcome = profile.outcome;
  const stepContent = [
    { label: "What ValueLoop found", value: `${profile.probability}% ${profile.riskLabel.toLowerCase()} risk`, note: profile.summary, user: "Review the changed signals and their freshness instead of opening four separate tools.", detail: <div className="demo-signal-grid">{cause.supporting.slice(0, 3).map((item) => <div key={item.text}><span>{item.source}</span><strong>{item.text}</strong><small>{item.timestamp}</small></div>)}</div> },
    { label: "Leading hypothesis", value: `${cause.label} · ${cause.confidence.toFixed(2)} confidence`, note: "This is a transparent hypothesis, not a verified cause.", user: "Compare supporting and contradictory evidence, then challenge the explanation if it does not fit.", detail: <div className="demo-evidence"><div><CheckCircle2 /><span><small>Supports</small><strong>{cause.supporting[0].text}</strong></span></div><div><XCircle /><span><small>Challenges</small><strong>{cause.contradicting[0]?.text ?? "No contradiction recorded"}</strong></span></div></div> },
    { label: "Safest useful response", value: profile.action.recommended, note: profile.action.explanation, user: "See why this action ranked first and why tempting alternatives were blocked.", detail: <div className="demo-policy"><span><Check /><strong>Eligible</strong>{profile.action.checks[0]}</span>{profile.action.rejected.slice(0, 2).map((item) => <span key={item.name}><X /><strong>{item.name} blocked</strong>{item.reason}</span>)}</div> },
    { label: profile.action.approvalRequired ? "Human review required" : "Within automatic demo guardrails", value: profile.action.approvalRequired ? `${account.owner} reviews the action` : "Eligible to start as a mock action", note: profile.action.approvalReason, user: "Approve, modify, or reject with a reason. The recommendation never bypasses policy.", detail: <div className="demo-checklist">{profile.action.checks.map((check) => <span key={check}><ShieldCheck />{check}</span>)}</div> },
    { label: "Intervention record", value: `${profile.action.recommended} · simulated`, note: "The prototype records the selected response, owner, decision version, and status. It does not contact a real customer.", user: "Confirm the final response and preserve customer-friendly choices such as pause, downgrade, or no action.", detail: <div className="demo-receipt"><code>INT-{2841 + churnProfiles.indexOf(profile)}</code><span><small>Owner</small><strong>{account.owner}</strong></span><span><small>Policy</small><strong>policy-v2.4</strong></span><span><small>Status</small><strong>Mock logged</strong></span></div> },
    { label: "Observed follow-up", value: `${outcome.healthDelta} health movement`, note: `${outcome.response}. ${outcome.observation}.`, user: "Review observed changes and decide whether to continue, adapt, or stop the playbook.", detail: <div className="demo-outcome"><span><small>Usage change</small><strong>{outcome.usageDelta}</strong></span><span><small>Customer response</small><strong>{outcome.response}</strong></span><span><small>Claim boundary</small><strong>Observed / simulated, not causal</strong></span></div> },
  ][step];

  const nextAction = () => {
    if (step < walkthroughSteps.length - 1) setStep(step + 1);
    else openOutcomes();
  };

  return <>
    <section className="guide-brief"><div><span>Problem</span><h2>Warning signs live in different systems.</h2><p>Usage falls in product analytics, severe tickets sit in support, and billing still looks healthy. A non-technical CSM has to connect that pattern manually.</p></div><ArrowRight /><div><span>ValueLoop response</span><h2>One explainable recovery path.</h2><p>The same evidence flows through risk, cause, policy, approval, intervention, and outcome records without handing control to a black box.</p></div></section>
    <section className="scenario-bar"><label htmlFor="demo-scenario"><span>Try another seeded situation</span><select id="demo-scenario" value={accountId} onChange={(event) => { setAccountId(event.target.value); setStep(0); }}>{churnProfiles.map((item) => <option value={item.accountId} key={item.accountId}>{getAccount(item.accountId).name} · {item.churnType}</option>)}</select></label><p><Badge severity={account.severity} risk={profile.probability} /> {account.mrr} MRR · renews {account.renewal}</p></section>
    <section className="walkthrough-shell">
      <nav className="walkthrough-nav" aria-label="Guided demo steps">{walkthroughSteps.map(([name, title], index) => <button key={name} className={index === step ? "active" : index < step ? "complete" : ""} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}><span>{index < step ? <Check /> : String(index + 1).padStart(2, "0")}</span><div><small>{name}</small><strong>{title}</strong></div></button>)}</nav>
      <AnimatePresence mode="wait" initial={false}><motion.article key={`${accountId}-${step}`} className="walkthrough-panel" initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -10 }} transition={reduce ? { duration: 0 } : spring}>
        <header><span>Step {step + 1} of 6 · {walkthroughSteps[step][0]}</span><h2>{walkthroughSteps[step][1]}</h2><p>{walkthroughSteps[step][2]}</p></header>
        <div className="walkthrough-result"><small>{stepContent.label}</small><strong>{stepContent.value}</strong><p>{stepContent.note}</p>{stepContent.detail}</div>
        <aside><HandPointing /><div><small>What the user does</small><p>{stepContent.user}</p></div></aside>
        <footer><button className="secondary" onClick={() => step === 0 ? openAccount(account.id) : step === 3 ? openApprovals() : openPlaybooks()}>{step === 0 ? "Open full evidence file" : step === 3 ? "Open approval inbox" : "Customize this logic"}<ArrowRight /></button><div><button className="text-btn" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Previous</button><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="primary" onClick={nextAction}>{step === 5 ? "View all outcomes" : "Next step"}<ArrowRight /></motion.button></div></footer>
      </motion.article></AnimatePresence>
    </section>
    <p className="prototype-note"><ShieldCheck />Fixture-only demonstration: signals, recommendations, approvals, and outcomes are deterministic mock data. No customer is contacted and no plan or payment is changed.</p>
  </>;
}

function PlaybookStudio({ openGuide }: { openGuide: () => void }) {
  const [presetId, setPresetId] = useState("northstar");
  const [confidence, setConfidence] = useState(65);
  const [frequency, setFrequency] = useState(1);
  const [approval, setApproval] = useState("CSM owner");
  const [customerChoice, setCustomerChoice] = useState(true);
  const [drafted, setDrafted] = useState(false);
  const [tested, setTested] = useState(false);
  const profile = getChurnProfile(presetId) ?? churnProfiles[0];
  const account = getAccount(profile.accountId);
  const prompt = `When ${profile.churnType.toLowerCase()} signals are strong, recommend ${profile.action.recommended.toLowerCase()}, keep outreach respectful, and require ${approval.toLowerCase()} review.`;
  return <>
    <section className="studio-intro"><div><span><Sparkle />Designed for operators, not data scientists</span><h2>Describe the customer situation. ValueLoop turns it into a reviewable playbook.</h2><p>Teams start from a plain-language template, adjust a few business controls, and preview exactly which evidence, actions, approvals, and outcomes the workflow will use.</p></div><button className="secondary" onClick={openGuide}><PlayCircle />See it run first</button></section>
    <section className="studio-layout">
      <div className="studio-form">
        <article className="studio-section"><header><span>01</span><div><h3>Choose a situation</h3><p>Start from one of the eight explainable churn pathways.</p></div></header><label><span>Playbook template</span><select value={presetId} onChange={(event) => { setPresetId(event.target.value); setTested(false); }}>{churnProfiles.map((item) => <option value={item.accountId} key={item.accountId}>{item.churnType} · {item.action.recommended}</option>)}</select></label></article>
        <article className="studio-section"><header><span>02</span><div><h3>Say what you want in plain language</h3><p>The text becomes a draft only. Structured policy controls remain authoritative.</p></div></header><label><span>Business instruction</span><textarea defaultValue={prompt} key={prompt} rows={4} /></label><button className="text-btn" onClick={() => setDrafted(true)}><Sparkle />Generate reviewable draft</button>{drafted && <p className="inline-success"><CheckCircle2 />Draft updated locally. Review the controls below before testing.</p>}</article>
        <article className="studio-section"><header><span>03</span><div><h3>Set the guardrails</h3><p>Use business terms; technical versions and audit fields are added automatically.</p></div></header><div className="control-grid"><label><span>Minimum evidence confidence <strong>{confidence}%</strong></span><input type="range" min="45" max="90" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label><span>Maximum customer outreach</span><select value={frequency} onChange={(event) => setFrequency(Number(event.target.value))}><option value={0}>No automatic outreach</option><option value={1}>Once every 14 days</option><option value={2}>Twice every 30 days</option></select></label><label><span>Who approves sensitive actions?</span><select value={approval} onChange={(event) => setApproval(event.target.value)}><option>CSM owner</option><option>CS manager</option><option>Finance reviewer</option><option>Support lead</option></select></label><label className="check-control"><input type="checkbox" checked={customerChoice} onChange={(event) => setCustomerChoice(event.target.checked)} /><span><strong>Keep customer-choice paths visible</strong>Show pause, downgrade, cancellation, and no-action where eligible.</span></label></div></article>
      </div>
      <aside className="playbook-preview"><header><span>Live playbook preview</span><strong>{profile.churnType}</strong><small>Draft · fixture only · policy-v2.4</small></header><div className="preview-flow"><div><span>IF</span><p>{profile.causes[0].supporting[0].text}</p><small>and evidence confidence is at least {confidence}%</small></div><ArrowDownRight /><div><span>THEN CONSIDER</span><p>{profile.action.recommended}</p><small>{profile.action.description}</small></div><ArrowDownRight /><div><span>ONLY WHEN</span>{profile.action.checks.map((check) => <small key={check}><Check />{check}</small>)}</div></div><dl><div><dt>Approval owner</dt><dd>{approval}</dd></div><div><dt>Frequency cap</dt><dd>{frequency === 0 ? "No automatic outreach" : frequency === 1 ? "1 / 14 days" : "2 / 30 days"}</dd></div><div><dt>Customer choice</dt><dd>{customerChoice ? "Required" : "Needs policy review"}</dd></div><div><dt>Outcome to observe</dt><dd>Usage, health, response, renewal</dd></div></dl><div className="preview-rejected"><small>Automatically blocked examples</small>{profile.action.rejected.map((item) => <p key={item.name}><X />{item.name}: {item.reason}</p>)}</div><motion.button className="primary full" onClick={() => setTested(true)}><PlayCircle />Test with {account.name}</motion.button>{tested && <div className="test-result"><CheckCircle2 /><span><strong>Test passed through the full loop</strong><small>{profile.probability}% risk · {profile.action.recommended} · {profile.action.approvalRequired ? "approval routed" : "eligible mock action"}</small></span></div>}</aside>
    </section>
    <section className="customization-boundary"><ShieldCheck /><div><strong>What teams can safely customize</strong><p>Thresholds, source mappings, segment rules, action eligibility, approval roles, frequency caps, templates, and observed outcome windows.</p></div><div><strong>What never becomes free-form</strong><p>Evidence provenance, policy checks, customer consent, audit records, rejected-action reasons, and the boundary against autonomous real-world execution.</p></div></section>
  </>;
}

function Queue({ openAccount, directory }: { openAccount: (accountId: string) => void; directory?: boolean }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("All"); const [view, setView] = useState<"graph" | "table">("graph");
  const reduce = useReducedMotion();

  // Fetch accounts (with analysis) from API; fall back to mock
  const { data: apiAccounts, loading: accountsLoading, usingFallback: accountsFallback } = useAccounts(true);

  const filtered = useMemo(() => apiAccounts.filter((account) => {
    const matchesSearch = `${account.name} ${account.churnType ?? ""} ${account.riskType}`.toLowerCase().includes(search.toLowerCase());
    const matchesDirectoryTab = tab === "All" || tab === "Healthy" && account.health >= 80 || account.segment === tab;
    const matchesRiskTab = tab === "All" || tab === "Urgent" && account.risk >= 68 || account.churnType?.startsWith(tab);
    return matchesSearch && (directory ? matchesDirectoryTab : matchesRiskTab);
  }), [apiAccounts, directory, search, tab]);
  return <>
    <FallbackBanner show={accountsFallback} />
    <LoadingBar active={accountsLoading} />
    {directory && <section className="mini-kpis"><div><Users /><span><strong>{apiAccounts.length}</strong><small>Active accounts</small></span></div><div><CircleDollarSign /><span><strong>RM 284k</strong><small>Managed MRR</small></span></div><div><BadgeCheck /><span><strong>94%</strong><small>Profiles complete</small></span></div><div><Clock3 /><span><strong>12 min</strong><small>Median freshness</small></span></div></section>}
    <motion.article initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : spring} className="card queue-card"><div className="queue-tools"><div className="tabs">{(directory ? ["All", "Enterprise", "Growth", "Team", "Healthy"] : churnTabs).map(x => <motion.button whileTap={reduce ? undefined : { scale: 0.96 }} className={tab === x ? "active" : ""} onClick={() => setTab(x)} key={x}>{x}{x === "Urgent" && <b>5</b>}</motion.button>)}</div><div className="tool-actions">{!directory && <div className="view-switch" aria-label="Queue view"><motion.button layout whileTap={reduce ? undefined : { scale: 0.94 }} aria-pressed={view === "graph"} className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}><LayoutDashboard />Graph</motion.button><motion.button layout whileTap={reduce ? undefined : { scale: 0.94 }} aria-pressed={view === "table"} className={view === "table" ? "active" : ""} onClick={() => setView("table")}><Menu />Table</motion.button></div>}<label className="search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts or churn types" /></label><button className="secondary"><Filter />Filters</button></div></div>{!directory && <div className="filter-row"><span>Pathway: {tab}</span><span>Renewal: 90 days</span><span>Freshness: Current</span><button onClick={() => setTab("All")}>Clear all</button></div>}<AnimatePresence mode="wait" initial={false}><motion.div key={directory ? "directory" : view} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={reduce ? { duration: 0 } : { duration: 0.18 }}>{!directory && view === "graph" ? <ChurnIssueMap rows={filtered} openAccount={openAccount} /> : <AccountTable rows={filtered} onSelect={(account) => openAccount(account.id)} />}</motion.div></AnimatePresence><footer className="table-footer"><span>Showing {filtered.length} of {apiAccounts.length} accounts · {directory ? "directory" : `${view} view`}</span><div><button disabled><ArrowLeft />Previous</button><button>Next<ArrowRight /></button></div></footer></motion.article>
  </>;
}

function Customer360({ accountId, back }: { accountId: string; back: () => void }) {
  const reduce = useReducedMotion();

  // Fetch the customer 360 profile (BackendAccount shape)
  const { data: backendAccount, loading: profileLoading, usingFallback: profileFallback } = useCustomer360(accountId);

  // Fetch analysis (health, risks, causes, actions)
  const { data: apiAnalysis, loading: analysisLoading, usingFallback: analysisFallback } = useAnalysis(accountId);

  // Fetch timeline events
  const { data: apiTimeline, loading: timelineLoading } = useTimeline(accountId);
  const timelineFallback = apiTimeline.length === 0;

  // Build account + profile from API or fall back to mock
  const mockAccount = getAccount(accountId);
  const mockProfile = getChurnProfile(accountId) ?? churnProfiles[0];

  const account: Account = backendAccount && apiAnalysis
    ? adaptAccount(backendAccount, apiAnalysis)
    : mockAccount;

  const baseProfile: typeof mockProfile = apiAnalysis && backendAccount
    ? adaptChurnProfile(apiAnalysis, backendAccount)
    : mockProfile;

  // Merge API timeline into profile (if available)
  const adaptedTimeline = apiTimeline.length > 0 ? adaptTimeline(apiTimeline) : [];
  const profile = adaptedTimeline.length > 0
    ? { ...baseProfile, timeline: adaptedTimeline }
    : baseProfile;

  const showFallback = profileFallback || analysisFallback || timelineFallback;
  const isLoading = profileLoading || analysisLoading || timelineLoading;

  const [metric, setMetric] = useState(profile.riskLabel); const [cause, setCause] = useState(profile.causes[0].label);
  const [reviewStatus, setReviewStatus] = useState<"pending" | "approved" | "modified" | "rejected">("pending");
  const [showModify, setShowModify] = useState(false);
  const [modifiedAction, setModifiedAction] = useState("No action");

  // Intervention workflow state (Phase 2)
  const [createdIntervention, setCreatedIntervention] = useState<Intervention | null>(null);
  const [creatingIntervention, setCreatingIntervention] = useState(false);
  const [interventionTransition, setInterventionTransition] = useState<string | null>(null);

  const handleCreateIntervention = async () => {
    setCreatingIntervention(true);
    try {
      const result = await createIntervention({
        account_id: accountId,
        recommended_action: profile.action.recommended,
      });
      setCreatedIntervention(result);
    } catch {
      // On failure, create a mock intervention for demo purposes
      setCreatedIntervention({
        id: `INT-mock-${Date.now()}`,
        account_id: accountId,
        recommended_action: profile.action.recommended,
        final_action: null,
        approver: null,
        status: 'pending',
        channel: null,
        reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } finally {
      setCreatingIntervention(false);
    }
  };

  const handleInterventionTransition = async (status: string) => {
    if (!createdIntervention) return;
    try {
      await transitionIntervention(createdIntervention.id, {
        status,
        actor_id: 'csm-demo',
        actor_role: 'csm',
        ...(status === 'rejected' ? { reason: 'User rejected from Customer 360' } : {}),
      });
    } catch {
      // Transition recorded locally on error
    }
    setInterventionTransition(status);
  };

  // Reset metric/cause when profile changes (accountId change)
  useEffect(() => {
    setMetric(profile.riskLabel);
    setCause(profile.causes[0]?.label ?? '');
    setReviewStatus("pending");
    setShowModify(false);
    setCreatedIntervention(null);
    setInterventionTransition(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const selectedCause = profile.causes.find((hypothesis) => hypothesis.label === cause) ?? profile.causes[0];
  const trend = profile.riskHistory.map((risk, index) => ({ day: riskDays[index], risk }));
  const metricTabs = [profile.riskLabel, "Downgrade", "Payment"].filter((item, index, items) => items.indexOf(item) === index);
  const eligibleAlternatives = profile.accountId === "northstar" ? ["Human outreach after incident resolution", "No action"] : ["No action"];
  const confidence = Math.round(profile.causes[0].confidence * 100);
  const agentSteps = [
    "Customer data loaded", "Health and risks calculated", "Cause hypotheses generated", "Policy validation completed", "Recommendation generated",
    profile.action.approvalRequired ? "CSM approval" : "Guardrail confirmation", "Action execution", "Outcome measurement",
  ].map((label, index) => ({
    label,
    state: index < 5 || (index === 5 && reviewStatus !== "pending") || (index === 6 && ["approved", "modified"].includes(reviewStatus)) ? "complete" : index === 5 && reviewStatus === "pending" ? "current" : index === 6 && reviewStatus === "rejected" ? "halted" : index === 7 && ["approved", "modified"].includes(reviewStatus) ? "current" : "pending",
  }));
  return <><FallbackBanner show={showFallback} /><LoadingBar active={isLoading} /><motion.button whileHover={reduce ? undefined : { x: -3 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="back" onClick={back}><ArrowLeft />Back to accounts</motion.button><section className="customer-layout">
    <motion.aside initial={reduce ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : spring} className="profile-side"><article className="card profile"><div className="profile-gradient" /><span className="profile-avatar">[{account.initials}]</span><SectionTitle eyebrow={`${account.segment} · ${account.plan}`} title={account.name} detail={account.industry} /><dl><div><dt>Churn pathway</dt><dd>{profile.churnType}</dd></div><div><dt>Monthly revenue</dt><dd>{account.mrr}</dd></div><div><dt>Renewal date</dt><dd>{account.renewal}</dd></div><div><dt>Account owner</dt><dd>{account.owner}</dd></div><div><dt>Contact status</dt><dd className="positive"><CheckCircle2 />Allowed</dd></div></dl><button className="secondary full"><UserRoundCheck />View account contacts</button></article>
    <article className="card sources"><SectionTitle eyebrow="Data quality" title="Source freshness" action={<span className="healthy"><i />Healthy</span>} />{(sourceFreshness[account.id] ?? sourceFreshness.northstar).map((item) => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></div>)}<button className="text-btn">View ingestion details <ArrowRight /></button></article></motion.aside>
    <div className="customer-main"><motion.article initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: 0.05 }} className="card risk-chart-card"><SectionTitle eyebrow={profile.churnType} title={`${metric} risk`} action={<div className="metric-tabs">{metricTabs.map((item) => <motion.button whileTap={reduce ? undefined : { scale: 0.95 }} className={metric === item ? "active" : ""} onClick={() => setMetric(item)} key={item}>{item}</motion.button>)}</div>} /><div className="risk-number"><strong>{profile.probability}%</strong><Delta value={profile.riskDelta} /><span>vs last week</span></div><div className="risk-chart"><ResponsiveContainer><AreaChart data={trend} margin={{ top: 8, right: 8, left: -20 }}><CartesianGrid vertical={false} stroke="#e8e8e3" /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} /><Tooltip /><Area dataKey="risk" stroke="#33483f" strokeWidth={2.5} fill="#e8eee9" /></AreaChart></ResponsiveContainer></div><p className="chart-note"><AlertCircle />{profile.summary}</p></motion.article>
    <RevealSection className="health-grid">{profile.health.map(([label, value, delta, tone], index) => <motion.article initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.045 }} whileHover={reduce ? undefined : { y: -2 }} className="card health-card" key={label}><div><span>{label}</span><Delta value={delta} points /></div><strong>{value}</strong><i><motion.b initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.1 + index * 0.04 }} className={tone} style={{ width: `${value}%`, transformOrigin: "left" }} /></i><small>{Math.abs(delta)} point {delta >= 0 ? "improvement" : "decline"}</small></motion.article>)}</RevealSection>
    <motion.article initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={reduce ? { duration: 0 } : spring} className="card agent-run">
      <SectionTitle eyebrow="Bounded agent run" title="Analysis and decision state" detail="The model recommends inside a deterministic policy and human approval boundary." action={<span className={cx("run-status", reviewStatus)}>{reviewStatus === "pending" ? "Waiting for review" : reviewStatus === "rejected" ? "Stopped safely" : "Decision recorded"}</span>} />
      <div className="agent-run-layout">
        <ol className="agent-steps" aria-label="Agent run progress">{agentSteps.map((step, index) => <li className={step.state} key={step.label}><span>{step.state === "complete" ? <Check /> : step.state === "current" ? <Clock3 /> : step.state === "halted" ? <X /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.state === "complete" ? "Complete" : step.state === "current" ? "Current checkpoint" : step.state === "halted" ? "Skipped after rejection" : "Not started"}</small></div></li>)}</ol>
        <aside className="agent-decision-summary"><header><span>Structured decision</span><strong>{confidence}% confidence</strong></header><h3>{profile.action.recommended}</h3><p>{profile.action.explanation}</p><div className="evidence-ids"><small>Supporting evidence</small>{profile.causes[0].supporting.slice(0, 3).map((item, index) => <span key={item.text}><code>{profile.accountId}-ev-{index + 1}</code>{item.text}</span>)}</div><dl><div><dt>Agent</dt><dd>decision-agent-v0.1</dd></div><div><dt>Policy</dt><dd>policy-v2.4</dd></div><div><dt>Analyzed</dt><dd>18 Jul 2026, 21:42</dd></div><div><dt>Approval</dt><dd>{profile.action.approvalRequired ? "CSM required" : "Not required"}</dd></div></dl></aside>
      </div>
    </motion.article>
    <RevealSection className="decision-grid"><motion.article initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={reduce ? { duration: 0 } : spring} className="cause-panel"><div className="insight-label">Explain · Cause hypotheses <ShieldCheck /></div><h2>Why is value deteriorating?</h2><p>Transparent rules rank likely explanations. These are hypotheses, not verified causes.</p><div className="cause-body"><div className="cause-list">{profile.causes.map((hypothesis, index) => <motion.button whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.985 }} transition={spring} className={selectedCause.label === hypothesis.label ? "active" : ""} onClick={() => setCause(hypothesis.label)} key={hypothesis.label}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{hypothesis.label}</strong><small>{hypothesis.strength}</small></span><em>{hypothesis.confidence.toFixed(2)}</em></motion.button>)}</div><AnimatePresence mode="wait" initial={false}><motion.div key={selectedCause.label} className="evidence" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={reduce ? { duration: 0 } : { duration: 0.18 }}><div className="support"><h3><CheckCircle2 />Supporting evidence</h3>{selectedCause.supporting.map((item) => <p key={item.text}><strong>{item.text}</strong><span>{item.source} · {item.timestamp}</span></p>)}</div><div className="contradict"><h3><XCircle />Contradictory evidence</h3>{selectedCause.contradicting.length ? selectedCause.contradicting.map((item) => <p key={item.text}><strong>{item.text}</strong><span>{item.source} · {item.timestamp}</span></p>) : <p><strong>No contradiction recorded</strong><span>Rule engine · current run</span></p>}</div></motion.div></AnimatePresence></div><footer><span>Rule <strong>cause-v1.5</strong></span><span>Generated <strong>21:42</strong></span><span>Threshold <strong>0.45</strong></span></footer></motion.article>
    <motion.article initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={reduce ? { duration: 0 } : { ...spring, delay: 0.07 }} className="card action-card"><SectionTitle eyebrow="Decide" title="Recommended action" action={<Badge severity={account.severity} />} /><div className="action-hero"><span><LifeBuoy /></span><div><strong>{profile.action.recommended}</strong><p>{profile.action.description}</p><small>AI confidence {confidence}%</small></div></div><p className="action-rationale">{profile.action.explanation}</p><div className="utility"><div><span>Benefit</span><strong>{profile.action.benefit}</strong></div><div><span>Friction</span><strong>{profile.action.friction}</strong></div><div><span>Risk</span><strong>{profile.action.risk}</strong></div></div><div className="checks">{profile.action.checks.map((check) => <span key={check}><Check />{check}</span>)}</div><div className="alternatives"><small>Eligible alternatives</small>{eligibleAlternatives.map((item) => <span key={item}><CheckCircle2 />{item}</span>)}</div><div className="rejected"><small>Rejected by policy</small>{profile.action.rejected.map((item) => <p key={item.name}><X /><span><strong>{item.name}</strong>{item.reason}</span></p>)}</div>{showModify && reviewStatus === "pending" && <div className="modify-action"><label htmlFor={`modify-${profile.accountId}`}>Choose an eligible action</label><select id={`modify-${profile.accountId}`} value={modifiedAction} onChange={(event) => setModifiedAction(event.target.value)}>{eligibleAlternatives.map((item) => <option key={item}>{item}</option>)}</select><textarea aria-label="Reason for modification" placeholder="Reason for modification" defaultValue="Use the lower-friction eligible option." /><button className="primary full" onClick={() => { setReviewStatus("modified"); setShowModify(false); }}><Check />Confirm modification</button></div>}{reviewStatus === "pending" && !showModify ? <div className="inline-approval"><button className="danger" onClick={() => setReviewStatus("rejected")}><X />Reject</button><button className="secondary" onClick={() => setShowModify(true)}><Menu />Modify</button><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={spring} className="primary" onClick={() => setReviewStatus("approved")}><Check />{profile.action.approvalRequired ? "Approve" : "Start mock action"}</motion.button></div> : reviewStatus !== "pending" && <div className={cx("inline-decision-result", reviewStatus)}><span>{reviewStatus === "rejected" ? <XCircle /> : <CheckCircle2 />}</span><div><strong>{reviewStatus === "modified" ? modifiedAction : `Action ${reviewStatus}`}</strong><small>{reviewStatus === "rejected" ? "Execution blocked. Audit event recorded." : "Mock execution recorded. Outcome measurement is ready."}</small></div><button className="text-btn" onClick={() => setReviewStatus("pending")}>Undo</button></div>}<div className="intervention-workflow" style={{ marginTop: '1rem', padding: '1rem', borderTop: '1px solid var(--border, #e8e8e3)' }}>
          <small style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Intervention workflow</small>
          {!createdIntervention ? (
            <motion.button
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className="primary"
              disabled={creatingIntervention}
              onClick={handleCreateIntervention}
            >
              {creatingIntervention ? 'Creating…' : <><PlayCircle />Create Intervention</>}
            </motion.button>
          ) : interventionTransition ? (
            <div className={cx('inline-decision-result', interventionTransition === 'rejected' ? 'rejected' : 'approved')}>
              <span>{interventionTransition === 'rejected' ? <XCircle /> : <CheckCircle2 />}</span>
              <div>
                <strong>Intervention {interventionTransition}</strong>
                <small>ID: {createdIntervention.id} · Status recorded in audit log.</small>
              </div>
              <button className="text-btn" onClick={() => { setCreatedIntervention(null); setInterventionTransition(null); }}>Reset</button>
            </div>
          ) : (
            <div className="inline-approval">
              <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Intervention {createdIntervention.id.slice(0, 12)} · {createdIntervention.status}</span>
              <button className="danger" onClick={() => handleInterventionTransition('rejected')}><X />Reject</button>
              <motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="primary" onClick={() => handleInterventionTransition('approved')}><Check />Approve</motion.button>
              <motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="secondary" onClick={() => handleInterventionTransition('executed')}><PlayCircle />Execute</motion.button>
            </div>
          )}
        </div>
<footer className="action-meta"><span>decision-agent-v0.1</span><span>policy-v2.4</span><span>18 Jul 2026, 21:42</span></footer></motion.article></RevealSection>
    <motion.article initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.16 }} transition={reduce ? { duration: 0 } : spring} className="card timeline"><SectionTitle eyebrow="Unified history" title="Account timeline" action={<button className="period">All events <ChevronDown /></button>} />{profile.timeline.map((event, index) => { const Icon = timelineIcons[event.tone]; return <motion.div initial={reduce ? false : { opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.7 }} transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.04 }} className="timeline-row" key={event.title}><span className={`event-icon ${event.tone}`}><Icon /></span><div><strong>{event.title}</strong><small>{event.meta}</small></div><MoreHorizontal /></motion.div>; })}</motion.article></div>
  </section></>;
}

function Approvals() {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState(false);

  // Fetch pending interventions from API
  const { data: interventions, loading, usingFallback, refresh } = useInterventions('pending');

  // For each intervention, fetch account details for context
  // We use the first 20 to avoid excessive parallel requests
  const interventionList = interventions.slice(0, 20);

  // Build mock fallback requests from churn profiles for when API is unreachable
  const mockRequests = churnProfiles.filter((p) => p.action.approvalRequired);

  // Determine the list to render: if using API data, use interventions; else use mock
  const displayCount = usingFallback ? mockRequests.length : interventionList.length;

  const [accountCache, setAccountCache] = useState<Record<string, BackendAccount>>({});
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Fetch account details for API interventions
  useEffect(() => {
    if (usingFallback || interventionList.length === 0) return;
    const ids = [...new Set(interventionList.map((i) => i.account_id))];
    const missing = ids.filter((id) => !accountCache[id]);
    if (missing.length === 0) return;
    setAccountsLoading(true);
    Promise.all(missing.map((id) => getCustomer360(id).catch(() => null)))
      .then((results) => {
        const next: Record<string, BackendAccount> = { ...accountCache };
        results.forEach((r, i) => { if (r) next[missing[i]] = r; });
        setAccountCache(next);
      })
      .finally(() => setAccountsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventionList.length, usingFallback]);

  // Selected item context
  const selectedItem = usingFallback ? mockRequests[selected] : interventionList[selected];
  const selectedAccountId = usingFallback
    ? (selectedItem as typeof mockRequests[number])?.accountId
    : (selectedItem as Intervention)?.account_id;
  const selectedAction = usingFallback
    ? (selectedItem as typeof mockRequests[number])?.action.recommended
    : (selectedItem as Intervention)?.recommended_action;

  // Resolve account for selected item
  const mockAccount = selectedAccountId ? getAccount(selectedAccountId) : accounts[0];
  const apiAccount = selectedAccountId ? accountCache[selectedAccountId] : undefined;
  const displayAccount: Account = apiAccount
    ? adaptAccount(apiAccount)
    : mockAccount;

  // Profile from mock for additional context (churn type, etc.)
  const mockProfile = selectedAccountId ? (getChurnProfile(selectedAccountId) ?? churnProfiles[0]) : churnProfiles[0];

  const handleTransition = async (status: 'approved' | 'rejected') => {
    if (usingFallback) {
      setDecision(status);
      return;
    }
    const intervention = selectedItem as Intervention;
    if (!intervention) return;
    setProcessing(true);
    try {
      await transitionIntervention(intervention.id, {
        status,
        actor_id: 'csm-demo',
        actor_role: 'csm',
        ...(status === 'rejected' ? { reason: 'User rejected' } : {}),
      });
      setDecision(status);
      refresh();
    } catch {
      // On error, still show the decision locally
      setDecision(status);
    } finally {
      setProcessing(false);
    }
  };

  return <>
    <FallbackBanner show={usingFallback} />
    <LoadingBar active={loading || accountsLoading} />
    <section className="approval-layout">
      <motion.article initial={reduce ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : spring} className="card approval-list">
        <SectionTitle eyebrow="Pending review" title={`${displayCount} governed requests`} action={<button className="icon-btn"><Filter /></button>} />
        <label className="search"><Search /><input placeholder="Search approvals" /></label>
        {usingFallback
          ? mockRequests.map((request, index) => {
              const requestAccount = getAccount(request.accountId);
              return <motion.button initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.035 }} whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.985 }} className={selected === index ? "active" : ""} onClick={() => { setSelected(index); setDecision("pending"); }} key={request.accountId}>
                <Avatar account={requestAccount} small /><span><strong>{requestAccount.name}</strong><small>{request.action.recommended}</small><em>{request.churnType}</em></span><b>{request.probability}%</b>
              </motion.button>;
            })
          : interventionList.map((intervention, index) => {
              const cached = accountCache[intervention.account_id];
              const name = cached?.name ?? intervention.account_id;
              const initials = cached?.initials ?? '??';
              const mockAcc = { id: intervention.account_id, name, initials, owner: cached?.owner_id ?? '', plan: cached?.plan ?? '', segment: cached?.segment ?? '', industry: cached?.industry ?? '', mrr: '', risk: 0, riskType: '', severity: 'Low' as Severity, health: 0, delta: 0, renewal: '', freshness: '', action: '' };
              return <motion.button initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.035 }} whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.985 }} className={selected === index ? "active" : ""} onClick={() => { setSelected(index); setDecision("pending"); }} key={intervention.id}>
                <Avatar account={mockAcc} small /><span><strong>{name}</strong><small>{intervention.recommended_action}</small><em>{intervention.status}</em></span><b>{intervention.id.slice(0, 8)}</b>
              </motion.button>;
            })
        }
      </motion.article>
      <motion.article initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: 0.05 }} className="card approval-detail">
        <div className="approval-head">
          <SectionTitle
            eyebrow={`Action request · ${usingFallback ? `INT-${2841 + selected}` : (selectedItem as Intervention)?.id?.slice(0, 12) ?? ''}`}
            title={selectedAction ?? ''}
            detail={`${displayAccount.name} · ${mockProfile.churnType} · Submitted by policy engine`}
          />
          <Badge severity={displayAccount.severity} risk={mockProfile.probability} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {decision === "pending" ? (
            <motion.div key={`pending-${selected}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={reduce ? { duration: 0 } : { duration: 0.18 }}>
              <div className="context-grid">
                <div><span>Owner</span><strong>{displayAccount.owner}</strong></div>
                <div><span>MRR</span><strong>{displayAccount.mrr}</strong></div>
                <div><span>Renewal</span><strong>{displayAccount.renewal}</strong></div>
                <div><span>Freshness</span><strong className="positive"><CheckCircle2 />{displayAccount.freshness}</strong></div>
              </div>
              <div className="approval-reason">
                <h3><ShieldCheck />Why this needs review</h3>
                <p>{mockProfile.action.approvalReason}</p>
                <ul>{mockProfile.action.checks.map((check) => <li key={check}><Check />{check}</li>)}</ul>
              </div>
              <blockquote>
                <small>Decision context</small>
                "{mockProfile.summary} Recommended response: {mockProfile.action.description}"
                <cite>Template explanation · {usingFallback ? 'deterministic mock data' : 'live API data'}</cite>
              </blockquote>
              <div className="approval-actions">
                <motion.button whileTap={reduce ? undefined : { scale: 0.97 }} className="danger" disabled={processing} onClick={() => handleTransition('rejected')}><X />Reject</motion.button>
                <motion.button whileTap={reduce ? undefined : { scale: 0.97 }} className="secondary"><Menu />Modify</motion.button>
                <motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.97 }} className="primary" disabled={processing} onClick={() => handleTransition('approved')}>{processing ? 'Processing…' : <><Check />Approve action</>}</motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div key={decision} initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: 0.98 }} transition={reduce ? { duration: 0 } : spring} className={`decision-result ${decision}`}>
              {decision === "approved" ? <CheckCircle2 /> : <XCircle />}
              <h3>Action {decision}</h3>
              <p>{usingFallback ? 'The mock decision was recorded locally. Refreshing resets this state.' : `Intervention transitioned to ${decision}. Audit log updated.`}</p>
              <motion.button whileTap={reduce ? undefined : { scale: 0.97 }} className="secondary" onClick={() => setDecision("pending")}>Reset view</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    </section>
  </>;
}

function Outcomes() {
  const reduce = useReducedMotion();

  // Fetch KPIs for acceptance/override rates
  const { data: kpis, loading: kpiLoading, usingFallback: kpiFallback } = useKPIs();

  // Fetch all outcomes from API
  const { data: apiOutcomes, loading: outcomesLoading, usingFallback: outcomesFallback } = useOutcomes();

  // Fetch all interventions to join with outcomes (for account_id, action details)
  const { data: apiInterventions, loading: interventionsLoading, usingFallback: interventionsFallback } = useInterventions();

  // Build a lookup from intervention_id → Intervention
  const interventionMap = useMemo(() => {
    const map: Record<string, Intervention> = {};
    apiInterventions.forEach((i) => { map[i.id] = i; });
    return map;
  }, [apiInterventions]);

  // Determine if we have real data or need to fall back to mock
  const showFallback = kpiFallback || outcomesFallback || interventionsFallback;
  const isLoading = kpiLoading || outcomesLoading || interventionsLoading;
  const hasApiOutcomes = !outcomesFallback && apiOutcomes.length > 0;

  // For the outcomes table: merge API data or fall back to mock churnProfiles
  const outcomeRows = useMemo(() => {
    if (hasApiOutcomes) {
      return apiOutcomes.map((o) => {
        const intervention = interventionMap[o.intervention_id];
        const accountId = intervention?.account_id ?? '';
        const mockAcc = getAccount(accountId);
        const mockProf = getChurnProfile(accountId);
        return {
          id: o.intervention_id,
          churnType: mockProf?.churnType ?? 'Unknown',
          accountName: mockAcc?.name ?? accountId,
          finalAction: intervention?.final_action ?? intervention?.recommended_action ?? '',
          status: o.renewed ? 'Renewed' : o.churned ? 'Churned' : o.downgraded ? 'Downgraded' : 'Observed',
          response: o.response ?? '',
          observation: o.observation ?? '',
          usageDelta: o.usage_delta != null ? `${o.usage_delta >= 0 ? '+' : ''}${o.usage_delta}%` : '—',
          healthDelta: o.health_delta != null ? `${o.health_delta >= 0 ? '+' : ''}${o.health_delta}` : '—',
        };
      });
    }
    // Mock fallback
    return churnProfiles.map((profile) => {
      const account = getAccount(profile.accountId);
      return {
        id: profile.accountId,
        churnType: profile.churnType,
        accountName: account.name,
        finalAction: profile.action.recommended,
        status: profile.outcome.status,
        response: profile.outcome.response,
        observation: profile.outcome.observation,
        usageDelta: profile.outcome.usageDelta,
        healthDelta: profile.outcome.healthDelta,
      };
    });
  }, [hasApiOutcomes, apiOutcomes, interventionMap]);

  return <>
    <FallbackBanner show={showFallback} />
    <LoadingBar active={isLoading} />
    <section className="kpi-grid">
      <Kpi label="Acceptance rate" value={kpis.acceptanceRate} delta={8.1} note="Recommendations accepted" icon={ThumbsUp} tone="green" />
      <Kpi label="Override rate" value={kpis.overrideRate} delta={-2.4} note="Decisions changed" icon={ArrowRight} tone="violet" />
      <Kpi label="Time to action" value="4.2h" delta={-18} note="Median, last 30 days" icon={Clock3} tone="blue" />
      <Kpi label="Health movement" value="+6.8" delta={4.1} note="Observed after intervention" icon={TrendingUp} tone="amber" />
    </section>
    <section className="chart-grid">
      <article className="card chart-card wide">
        <SectionTitle eyebrow="Workflow movement" title="Recommendation decisions" detail="Observed activity only; no causal claim." />
        <div className="chart"><ResponsiveContainer><BarChart data={outcomeTrend}><CartesianGrid vertical={false} stroke="#e8e8e3" /><XAxis dataKey="week" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="accepted" fill="#33483f" radius={[5,5,0,0]} /><Bar dataKey="overridden" fill="#c7c9c3" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div>
      </article>
      <article className="card recovery">
        <small>Observed recovery</small>
        <div><span className="avatar">[NL]</span><span><strong>Northstar Labs</strong><p>Support escalation · {hasApiOutcomes ? 'recorded' : 'simulated'}</p></span></div>
        <section><span>Health score</span><div><strong>49</strong><ArrowRight /><strong>61</strong></div><Delta value={12} points /></section>
        <ul><li><CheckCircle2 />Severe ticket resolved</li><li><TrendingUp />Usage improved 18%</li><li><Clock3 />Observed over 14 days</li></ul>
        <em>{hasApiOutcomes ? 'Observed outcome from API' : 'Simulated outcome · not causal evidence'}</em>
      </article>
    </section>
    <article className="card queue-card">
      <SectionTitle eyebrow="Intervention history" title="Observed outcomes" detail="Changes are observations, not causal uplift." action={<button className="secondary"><Filter />Filter</button>} />
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Churn pathway</th><th>Account</th><th>Final action</th><th>Status</th><th>Response</th><th>Usage Δ</th><th>Health Δ</th></tr></thead>
          <tbody>
            {outcomeRows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.churnType}</strong></td>
                <td>{row.accountName}</td>
                <td>{row.finalAction}</td>
                <td><span className="badge badge-low"><i />{row.status}</span></td>
                <td>{row.response}<small>{row.observation}</small></td>
                <td>{row.usageDelta}</td>
                <td><strong className="positive">{row.healthDelta}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  </>;
}

function Audit() {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('intervention');
  const [entityId, setEntityId] = useState('');

  // Build params for the API call
  const apiParams: Record<string, string> = { entity_type: entityType, limit: '50' };
  if (entityId) apiParams.entity_id = entityId;

  // Fetch audit logs from API
  const { data: apiLogs, loading, usingFallback } = useAudit(apiParams);

  // Adapt API logs to frontend format
  const adaptedLogs: FrontendAuditLog[] = useMemo(() => {
    if (!usingFallback && apiLogs.length > 0) {
      return apiLogs.map((log: any) => adaptAuditLog(log));
    }
    return [];
  }, [apiLogs, usingFallback]);

  // Mock fallback rows
  const mockRows = churnProfiles.map((profile, index) => ({
    id: `AUD-${9031 - index}`,
    time: `21:${String(42 - index * 3).padStart(2, '0')}:08`,
    actor: profile.action.approvalRequired ? 'Policy engine' : 'Decision engine',
    account: getAccount(profile.accountId),
    profile,
    entity: `INT-${2841 - index}`,
  }));

  const hasApiData = !usingFallback && adaptedLogs.length > 0;

  // Selected item for diff view
  const selectedMock = mockRows.find((row) => row.id === expanded);
  const selectedApi = hasApiData ? adaptedLogs.find((log) => log.entityId === expanded) : undefined;

  return <>
    <FallbackBanner show={usingFallback} />
    <LoadingBar active={loading} />
    <article className="card queue-card">
      <div className="queue-tools">
        <div className="tabs">
          {['intervention', 'account', 'outcome', 'all'].map((type) => (
            <button key={type} className={entityType === type || (type === 'all' && entityType === '') ? 'active' : ''} onClick={() => { setEntityType(type === 'all' ? '' : type); setExpanded(null); }}>
              {type === 'all' ? 'All events' : type === 'intervention' ? 'Decisions' : type === 'account' ? 'Approvals' : 'Data'}
            </button>
          ))}
        </div>
        <div className="tool-actions">
          <label className="search"><Search /><input placeholder="Entity ID" value={entityId} onChange={(e) => { setEntityId(e.target.value); setExpanded(null); }} /></label>
          <button className="secondary"><Filter />Filters</button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity type</th><th>Entity ID</th><th>Reason</th><th /></tr></thead>
          <tbody>
            {hasApiData
              ? adaptedLogs.map((log) => (
                  <tr key={log.entityId + log.timestamp} className={expanded === log.entityId ? 'selected' : ''} onClick={() => setExpanded(expanded === log.entityId ? null : log.entityId)}>
                    <td><strong>{new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong><small>{new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small></td>
                    <td>{log.actorId}<small>{log.actorRole}</small></td>
                    <td><strong>{log.action}</strong></td>
                    <td>{log.entityType}</td>
                    <td><code>{log.entityId}</code></td>
                    <td>{log.reason ?? '—'}</td>
                    <td><ChevronDown className={expanded === log.entityId ? 'rotated' : ''} /></td>
                  </tr>
                ))
              : mockRows.map((row) => (
                  <tr key={row.id} className={expanded === row.id ? 'selected' : ''} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                    <td><strong>{row.time}</strong><small>18 Jul 2026</small></td>
                    <td>{row.actor}</td>
                    <td><strong>{row.profile.churnType} recommendation created</strong></td>
                    <td>intervention</td>
                    <td><code>{row.entity}</code></td>
                    <td>—</td>
                    <td><ChevronDown className={expanded === row.id ? 'rotated' : ''} /></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      {expanded && selectedApi && (
        <div className="audit-diff">
          <header><ShieldCheck /><span><strong>{selectedApi.action} · {selectedApi.entityId}</strong><small>{selectedApi.entityType} · immutable event record</small></span><button className="icon-btn" onClick={() => setExpanded(null)}><X /></button></header>
          <div>
            <section><span>Before</span><pre>{JSON.stringify(selectedApi.before ?? {}, null, 2)}</pre></section>
            <section><span>After</span><pre>{JSON.stringify(selectedApi.after ?? {}, null, 2)}</pre></section>
          </div>
        </div>
      )}
      {expanded && selectedMock && !hasApiData && (
        <div className="audit-diff">
          <header><ShieldCheck /><span><strong>Decision change · {expanded}</strong><small>{selectedMock.account.name} · immutable event record</small></span><button className="icon-btn" onClick={() => setExpanded(null)}><X /></button></header>
          <div>
            <section><span>Before</span><pre>{`{\n  "recommendation": null,\n  "approval_status": null\n}`}</pre></section>
            <section><span>After</span><pre>{JSON.stringify({ churn_pathway: selectedMock.profile.churnType, recommendation: selectedMock.profile.action.recommended, approval_status: selectedMock.profile.action.approvalRequired ? 'csm_review' : 'eligible', rule_version: 'policy-v2.4' }, null, 2)}</pre></section>
          </div>
        </div>
      )}
    </article>
  </>;
}

export function ValueLoopApp({ initialScreen, initialAccountId = "northstar" }: { initialScreen: Screen; initialAccountId?: string }) {
  const router = useRouter(); const screen = initialScreen; const [mobile, setMobile] = useState(false); const [fresh, setFresh] = useState(false); const [tour, setTour] = useState(false);
  const reduce = useReducedMotion();
  const activeAccount = getAccount(initialAccountId); const activeProfile = getChurnProfile(activeAccount.id);
  const select = (s: Screen, accountId?: string) => { router.push(s === "account" ? `/accounts/${accountId ?? activeAccount.id}` : routes[s]); setMobile(false); window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); };
  const h: [string, string, string] = screen === "account" ? [`Account / ${activeAccount.name}`, "Customer 360", `${activeProfile?.churnType ?? "Account"}: unified value, risk, evidence, decisions, and activity.`] : headings[screen];
  const activeNav = (id: Screen) => screen === id || screen === "account" && id === "accounts";
  return <div className="shell"><a className="skip-link" href="#main-content">Skip to main content</a><aside className={cx("sidebar", mobile && "open")}><div className="brand"><motion.span initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0 } : spring}><Activity /></motion.span><div><strong>ValueLoop</strong><small>Customer intelligence</small></div><button aria-label="Close navigation" onClick={() => setMobile(false)}><X /></button></div><nav aria-label="Primary navigation"><small>Workspace</small>{nav.map(([id, label, Icon], index) => <motion.button initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.035 }} whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.985 }} key={id} aria-current={activeNav(id) ? "page" : undefined} className={activeNav(id) ? "active" : ""} onClick={() => select(id)}><Icon /><span>{label}</span>{id === "approvals" && <b>{churnProfiles.filter((profile) => profile.action.approvalRequired).length}</b>}</motion.button>)}<small className="nav-section">Explore & configure</small>{exploreNav.map(([id, label, Icon], index) => <motion.button initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: 0.18 + index * 0.035 }} whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.985 }} key={id} aria-current={activeNav(id) ? "page" : undefined} className={activeNav(id) ? "active" : ""} onClick={() => select(id)}><Icon /><span>{label}</span>{id === "guide" && <em>Start</em>}</motion.button>)}</nav><div className="sidebar-foot"><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.99 }} className="fresh-card" onClick={() => setFresh(!fresh)}><span><Database /></span><div><strong>Sources healthy</strong><small>Updated 8 min ago</small></div><ChevronRight /></motion.button><AnimatePresence>{fresh && <motion.div initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }} transition={reduce ? { duration: 0 } : spring} className="fresh-pop"><strong>Demo data is current</strong><p>All four sources passed validation.</p><button onClick={() => setFresh(false)}>Run mock refresh</button></motion.div>}</AnimatePresence><div className="user"><span>AR</span><div><strong>Aisha Rahman</strong><small>Customer Success Manager</small></div><MoreHorizontal aria-hidden="true" /></div></div></aside><AnimatePresence>{mobile && <motion.button initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} className="scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}</AnimatePresence>
  <main id="main-content"><motion.header initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : spring} className="topbar"><motion.button whileTap={reduce ? undefined : { scale: 0.94 }} aria-label="Open navigation" className="menu" onClick={() => setMobile(true)}><Menu /></motion.button><div className="crumb"><LayoutDashboard /><span>Workspace</span><ChevronRight /><strong>{screen === "account" ? activeAccount.name : h[1]}</strong></div><div className="top-actions"><label><span className="sr-only">Search accounts</span><Search /><input aria-label="Search accounts" placeholder="Search accounts..." /><kbd>⌘ K</kbd></label><motion.button whileTap={reduce ? undefined : { scale: 0.92 }} aria-label="View notifications" className="icon-btn notify"><Bell /><i /></motion.button><button aria-label="Change reporting date" className="period">18 Jul 2026 <ChevronDown /></button></div></motion.header><div className="page"><motion.header initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { ...spring, delay: 0.04 }} className="page-head"><div><span>{h[0]}</span><h1>{h[1]}</h1><p>{h[2]}</p></div><div className="page-head-actions"><motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="secondary tutorial-launch" onClick={() => setTour(true)}><HandPointing />Page tutorial</motion.button>{screen === "overview" && <motion.button whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={spring} className="primary" onClick={() => select("risk")}><Gauge />Open risk queue</motion.button>}{screen === "risk" && <motion.button whileTap={reduce ? undefined : { scale: 0.98 }} className="secondary"><Database />Refresh analysis</motion.button>}{screen === "audit" && <motion.button whileTap={reduce ? undefined : { scale: 0.98 }} className="secondary"><ShieldCheck />Manager view</motion.button>}</div></motion.header>
  <motion.div key={screen} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.22, delay: 0.08 }}>{screen === "overview" && <Overview openAccount={(accountId) => select("account", accountId)} openRisk={() => select("risk")} openGuide={() => select("guide")} openPlaybooks={() => select("playbooks")} />}{screen === "risk" && <Queue openAccount={(accountId) => select("account", accountId)} />}{screen === "accounts" && <Queue openAccount={(accountId) => select("account", accountId)} directory />}{screen === "account" && <Customer360 accountId={activeAccount.id} back={() => select("accounts")} />}{screen === "approvals" && <Approvals />}{screen === "outcomes" && <Outcomes />}{screen === "audit" && <Audit />}{screen === "guide" && <GuidedDemo openAccount={(accountId) => select("account", accountId)} openApprovals={() => select("approvals")} openOutcomes={() => select("outcomes")} openPlaybooks={() => select("playbooks")} />}{screen === "playbooks" && <PlaybookStudio openGuide={() => select("guide")} />}</motion.div></div></main>{tour && <PageTour screen={screen} onClose={() => setTour(false)} />}</div>;
}
