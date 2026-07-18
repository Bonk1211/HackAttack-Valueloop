"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pulse as Activity, WarningCircle as AlertCircle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  SealCheck as BadgeCheck, Bell, ClipboardText as BookOpenCheck, Check, CheckCircle as CheckCircle2,
  CaretDown as ChevronDown, CaretRight as ChevronRight, CurrencyDollar as CircleDollarSign,
  Clock as Clock3, Database, FileText as FileClock, Funnel as Filter, Gauge,
  SquaresFour as LayoutDashboard, Lifebuoy as LifeBuoy, List as Menu,
  DotsThree as MoreHorizontal, MagnifyingGlass as Search, ShieldCheck,
  Target, ThumbsUp, TrendDown as TrendingDown, TrendUp as TrendingUp,
  UserCircleCheck as UserRoundCheck, Users,
  X, XCircle,
} from "@phosphor-icons/react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { accounts, actionMix, churnProfiles, getChurnProfile, outcomeTrend, portfolioTrend, sourceFreshness, type Account, type Severity } from "@/lib/mock-data";

export type Screen = "overview" | "risk" | "accounts" | "account" | "approvals" | "outcomes" | "audit";

const nav = [
  ["overview", "Overview", LayoutDashboard], ["risk", "Risk Queue", Gauge], ["accounts", "Accounts", Users],
  ["approvals", "Approvals", BookOpenCheck], ["outcomes", "Outcomes", Target], ["audit", "Audit Log", FileClock],
] as const;
const routes: Record<Screen, string> = {
  overview: "/",
  risk: "/risk-queue",
  accounts: "/accounts",
  account: "/accounts/northstar",
  approvals: "/approvals",
  outcomes: "/outcomes",
  audit: "/audit",
};
const headings: Record<Screen, [string, string, string]> = {
  overview: ["Portfolio intelligence", "Good afternoon, Aisha", "Eight churn pathways need attention. Start with the clearest value-loss signals."],
  risk: ["Detect", "Risk Queue", "Prioritize accounts by urgency, revenue exposure, and evidence confidence."],
  accounts: ["Customer 360", "Accounts", "Find every customer, subscription, health profile, and latest intervention."],
  account: ["Account / Northstar Labs", "Customer 360", "Unified value, risk, evidence, decisions, and activity for one account."],
  approvals: ["Approve", "Approval Inbox", "Review sensitive actions with complete account and policy context."],
  outcomes: ["Measure", "Outcomes", "Track observed results without implying causal uplift."],
  audit: ["Governance", "Audit Log", "Trace every recommendation, override, approval, and state change."],
};

const churnTabs = ["All", "Urgent", "Value", "Experience", "Product-fit", "Price", "Involuntary", "Competitive", "Lifecycle", "Silent"];
const riskDays = ["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul", "17 Jul", "18 Jul"];
const getAccount = (accountId: string) => accounts.find((account) => account.id === accountId) ?? accounts[0];
const timelineIcons = { critical: AlertCircle, warning: TrendingDown, positive: CheckCircle2, blue: Activity } as const;

function cx(...items: Array<string | false | undefined>) { return items.filter(Boolean).join(" "); }
function Avatar({ account, small }: { account: Account; small?: boolean }) { return <span aria-label={`${account.name} monogram`} className={cx("avatar", small && "avatar-sm")}>[{account.initials}]</span>; }
function Delta({ value, points }: { value: number; points?: boolean }) {
  return <span className={cx("delta", value >= 0 ? "up" : "down")}>{value >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{Math.abs(value)}{points ? " pts" : "%"}</span>;
}
function Badge({ severity, risk }: { severity: Severity; risk?: number }) { return <span className={`badge badge-${severity.toLowerCase()}`}><i />{risk !== undefined && `${risk}% `}{severity}</span>; }
function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-title"><div><span>{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}
function Kpi({ label, value, delta, note, icon: Icon, tone }: { label: string; value: string; delta: number; note: string; icon: typeof Activity; tone: string }) {
  return <article className="card kpi"><span className={`kpi-icon ${tone}`}><Icon /></span><div><small>{label}</small><div><strong>{value}</strong><Delta value={delta} /></div><p>{note}</p></div><button className="icon-btn" aria-label={`More ${label} options`}><MoreHorizontal /></button></article>;
}

function AccountTable({ rows, selected, onSelect, compact }: { rows: Account[]; selected?: string; onSelect: (a: Account) => void; compact?: boolean }) {
  if (!rows.length) return <div className="empty"><Search /><strong>No matching accounts</strong><span>Try changing the active filters.</span></div>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Account</th><th>MRR</th><th>Churn pathway</th>{!compact && <th>Health</th>}<th>Renewal</th>{!compact && <th>Next action</th>}<th /></tr></thead><tbody>{rows.map(a => <tr key={a.id} className={selected === a.id ? "selected" : ""} onClick={() => onSelect(a)}><td><div className="account-cell"><Avatar account={a} small /><span><strong>{a.name}</strong><small>{a.owner}</small></span></div></td><td><strong>{a.mrr}</strong></td><td><div className="risk-cell"><span>{a.churnType ?? "Expansion ready"}</span><small>{a.riskType}</small><Badge severity={a.severity} risk={a.risk} /></div></td>{!compact && <td><div className="health-cell"><strong>{a.health}</strong><Delta value={a.delta} points /></div></td>}<td><span>{a.renewal}</span><small>{a.freshness}</small></td>{!compact && <td><span className="action-pill">{a.action}</span></td>}<td><button className="row-btn" aria-label={`Open ${a.name}`}><ChevronRight /></button></td></tr>)}</tbody></table></div>;
}

function ChurnIssueMap({ rows, openAccount }: { rows: Account[]; openAccount: (accountId: string) => void }) {
  const mapped = rows.flatMap((account) => { const profile = getChurnProfile(account.id); return profile ? [{ account, profile }] : []; });
  const [selectedId, setSelectedId] = useState(mapped[0]?.account.id ?? "northstar");
  if (!mapped.length) return <div className="empty"><Search /><strong>No mapped churn issues</strong><span>Try changing the active filters.</span></div>;
  const selected = mapped.find(({ account }) => account.id === selectedId) ?? mapped[0];
  return <section className="issue-map" aria-label="Churn issue map">
    <header><div><span>Signal map</span><h3>Account → pathway → leading issue</h3><p>Select a route to inspect its evidence and policy-safe response.</p></div><div className="map-legend"><span><i className="critical" />Critical</span><span><i className="high" />High</span><span><i className="medium" />Medium</span></div></header>
    <div className="issue-map-layout"><div className="issue-routes">{mapped.map(({ account, profile }, index) => <button aria-pressed={selected.account.id === account.id} className={selected.account.id === account.id ? "active" : ""} onClick={() => setSelectedId(account.id)} key={account.id}>
      <span className="route-index">{String(index + 1).padStart(2, "0")}</span><span className="map-node account-node"><Avatar account={account} small /><span><strong>{account.name}</strong><small>{account.mrr} MRR</small></span></span><span className="map-link"><i /><em>{profile.probability}% risk</em></span><span className="map-node pathway-node"><small>Pathway</small><strong>{profile.churnType}</strong></span><span className="map-link"><i /><em>{profile.causes[0].confidence.toFixed(2)}</em></span><span className="map-node issue-node"><small>Leading issue</small><strong>{profile.causes[0].label}</strong></span><ChevronRight />
    </button>)}</div>
    <aside className="map-inspector"><span>Selected route · {selected.profile.churnType}</span><h3>{selected.account.name}</h3><p>{selected.profile.summary}</p><dl><div><dt>Leading issue</dt><dd>{selected.profile.causes[0].label} · {selected.profile.causes[0].confidence.toFixed(2)}</dd></div><div><dt>Strongest signal</dt><dd>{selected.profile.causes[0].supporting[0].text}</dd></div><div><dt>Contradiction</dt><dd>{selected.profile.causes[0].contradicting[0]?.text ?? "None recorded"}</dd></div><div><dt>Safe response</dt><dd>{selected.profile.action.recommended}</dd></div></dl><button className="primary full" onClick={() => openAccount(selected.account.id)}>Open evidence file <ArrowRight /></button><small>Hypothesis only · rule cause-v1.5</small></aside></div>
  </section>;
}

function Overview({ openAccount, openRisk }: { openAccount: (accountId: string) => void; openRisk: () => void }) {
  const [selected, setSelected] = useState(accounts[0]);
  const selectedProfile = getChurnProfile(selected.id) ?? churnProfiles[0];
  return <>
    <section className="kpi-grid">
      <Kpi label="At-risk MRR" value="RM 48.0k" delta={12.4} note="Across eight churn pathways" icon={CircleDollarSign} tone="blue" />
      <Kpi label="High-risk accounts" value="8" delta={3} note="Seven require governed review" icon={AlertCircle} tone="amber" />
      <Kpi label="Action acceptance" value="72%" delta={8.1} note="Last 30 days" icon={ThumbsUp} tone="green" />
      <Kpi label="Data freshness" value="98.2%" delta={1.3} note="All core sources healthy" icon={Database} tone="violet" />
    </section>
    <section className="overview-grid">
      <article className="card table-card"><SectionTitle eyebrow="Priority queue" title="Accounts needing attention" action={<button className="text-btn" onClick={openRisk}>View risk queue <ArrowRight /></button>} /><AccountTable rows={accounts.slice(0, 5)} selected={selected.id} onSelect={setSelected} compact /></article>
      <aside className="insight" aria-label={`Selected insight for ${selected.name}`}>
        <header className="ticket-head"><div className="insight-label"><span>{selectedProfile.churnType}</span><span>Case {String(churnProfiles.indexOf(selectedProfile) + 1).padStart(3, "0")}</span></div><div className="insight-account"><Avatar account={selected} /><span><strong>{selected.name}</strong><small>{selected.plan} · {selected.mrr} MRR</small></span></div></header>
        <div className="insight-risk"><div><span>{selectedProfile.riskLabel} risk</span><Badge severity={selected.severity} /></div><strong>{selectedProfile.probability}<small>%</small></strong></div>
        <div className="hypotheses"><small>Likely causes</small>{selectedProfile.causes.slice(0, 2).map((hypothesis) => <div className="ticket-hypothesis" key={hypothesis.label}><span>{hypothesis.label}</span><b>{hypothesis.confidence.toFixed(2)}</b><i><b style={{ width: `${hypothesis.confidence * 100}%` }} /></i></div>)}</div>
        <ul>{selectedProfile.causes[0].supporting.slice(0, 3).map((evidence) => <li key={evidence.text}><Activity />{evidence.text}</li>)}</ul>
        <div className="ticket-stub"><div className="insight-action"><small>Admit one next action</small><strong>{selectedProfile.action.recommended}</strong><span>{selectedProfile.action.rejected[0].name} rejected · {selectedProfile.action.rejected[0].reason}</span></div><button className="primary light" onClick={() => openAccount(selected.id)}>Open Customer 360 <ArrowRight /></button><code aria-hidden="true">VL–{selected.renewal.slice(0, 2)}–{selected.initials}</code></div>
      </aside>
    </section>
    <section className="chart-grid">
      <article className="card chart-card wide"><SectionTitle eyebrow="Portfolio movement" title="At-risk MRR trend" detail="RM 48.0k is currently exposed across the eight seeded pathways." action={<button className="period">Last 6 months <ChevronDown /></button>} /><div className="chart"><ResponsiveContainer><AreaChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -20 }}><CartesianGrid vertical={false} stroke="#e8e8e3" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} /><Tooltip /><Area dataKey="mrr" name="At-risk MRR (RM k)" stroke="#33483f" strokeWidth={2.5} fill="#e8eee9" /></AreaChart></ResponsiveContainer></div></article>
      <article className="card chart-card"><SectionTitle eyebrow="Recommendations" title="Action mix" detail="Safe, eligible actions this month." /><div className="donut"><div className="donut-chart"><ResponsiveContainer><PieChart><Pie data={actionMix} dataKey="value" innerRadius={46} outerRadius={70} paddingAngle={3}>{actionMix.map(x => <Cell key={x.name} fill={x.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><span><strong>50</strong><small>actions</small></span></div><div className="legend">{actionMix.map(x => <div key={x.name}><i style={{ background: x.fill }} /><span>{x.name}</span><strong>{x.value}%</strong></div>)}</div></div></article>
    </section>
  </>;
}

function Queue({ openAccount, directory }: { openAccount: (accountId: string) => void; directory?: boolean }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("All"); const [view, setView] = useState<"graph" | "table">("graph");
  const filtered = useMemo(() => accounts.filter((account) => {
    const matchesSearch = `${account.name} ${account.churnType ?? ""} ${account.riskType}`.toLowerCase().includes(search.toLowerCase());
    const matchesDirectoryTab = tab === "All" || tab === "Healthy" && account.health >= 80 || account.segment === tab;
    const matchesRiskTab = tab === "All" || tab === "Urgent" && account.risk >= 68 || account.churnType?.startsWith(tab);
    return matchesSearch && (directory ? matchesDirectoryTab : matchesRiskTab);
  }), [directory, search, tab]);
  return <>
    {directory && <section className="mini-kpis"><div><Users /><span><strong>50</strong><small>Active accounts</small></span></div><div><CircleDollarSign /><span><strong>RM 284k</strong><small>Managed MRR</small></span></div><div><BadgeCheck /><span><strong>94%</strong><small>Profiles complete</small></span></div><div><Clock3 /><span><strong>12 min</strong><small>Median freshness</small></span></div></section>}
    <article className="card queue-card"><div className="queue-tools"><div className="tabs">{(directory ? ["All", "Enterprise", "Growth", "Team", "Healthy"] : churnTabs).map(x => <button className={tab === x ? "active" : ""} onClick={() => setTab(x)} key={x}>{x}{x === "Urgent" && <b>5</b>}</button>)}</div><div className="tool-actions">{!directory && <div className="view-switch" aria-label="Queue view"><button aria-pressed={view === "graph"} className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}><LayoutDashboard />Graph</button><button aria-pressed={view === "table"} className={view === "table" ? "active" : ""} onClick={() => setView("table")}><Menu />Table</button></div>}<label className="search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts or churn types" /></label><button className="secondary"><Filter />Filters</button></div></div>{!directory && <div className="filter-row"><span>Pathway: {tab}</span><span>Renewal: 90 days</span><span>Freshness: Current</span><button onClick={() => setTab("All")}>Clear all</button></div>}{!directory && view === "graph" ? <ChurnIssueMap rows={filtered} openAccount={openAccount} /> : <AccountTable rows={filtered} onSelect={(account) => openAccount(account.id)} />}<footer className="table-footer"><span>Showing {filtered.length} of {accounts.length} seeded accounts · {directory ? "directory" : `${view} view`}</span><div><button disabled><ArrowLeft />Previous</button><button>Next<ArrowRight /></button></div></footer></article>
  </>;
}

function Customer360({ accountId, back }: { accountId: string; back: () => void }) {
  const account = getAccount(accountId); const profile = getChurnProfile(account.id) ?? churnProfiles[0];
  const [metric, setMetric] = useState(profile.riskLabel); const [cause, setCause] = useState(profile.causes[0].label);
  const selectedCause = profile.causes.find((hypothesis) => hypothesis.label === cause) ?? profile.causes[0];
  const trend = profile.riskHistory.map((risk, index) => ({ day: riskDays[index], risk }));
  const metricTabs = [profile.riskLabel, "Downgrade", "Payment"].filter((item, index, items) => items.indexOf(item) === index);
  return <><button className="back" onClick={back}><ArrowLeft />Back to accounts</button><section className="customer-layout">
    <aside className="profile-side"><article className="card profile"><div className="profile-gradient" /><span className="profile-avatar">[{account.initials}]</span><SectionTitle eyebrow={`${account.segment} · ${account.plan}`} title={account.name} detail={account.industry} /><dl><div><dt>Churn pathway</dt><dd>{profile.churnType}</dd></div><div><dt>Monthly revenue</dt><dd>{account.mrr}</dd></div><div><dt>Renewal date</dt><dd>{account.renewal}</dd></div><div><dt>Account owner</dt><dd>{account.owner}</dd></div><div><dt>Contact status</dt><dd className="positive"><CheckCircle2 />Allowed</dd></div></dl><button className="secondary full"><UserRoundCheck />View account contacts</button></article>
    <article className="card sources"><SectionTitle eyebrow="Data quality" title="Source freshness" action={<span className="healthy"><i />Healthy</span>} />{(sourceFreshness[account.id] ?? sourceFreshness.northstar).map((item) => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></div>)}<button className="text-btn">View ingestion details <ArrowRight /></button></article></aside>
    <div className="customer-main"><article className="card risk-chart-card"><SectionTitle eyebrow={profile.churnType} title={`${metric} risk`} action={<div className="metric-tabs">{metricTabs.map((item) => <button className={metric === item ? "active" : ""} onClick={() => setMetric(item)} key={item}>{item}</button>)}</div>} /><div className="risk-number"><strong>{profile.probability}%</strong><Delta value={profile.riskDelta} /><span>vs last week</span></div><div className="risk-chart"><ResponsiveContainer><AreaChart data={trend} margin={{ top: 8, right: 8, left: -20 }}><CartesianGrid vertical={false} stroke="#e8e8e3" /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} /><Tooltip /><Area dataKey="risk" stroke="#33483f" strokeWidth={2.5} fill="#e8eee9" /></AreaChart></ResponsiveContainer></div><p className="chart-note"><AlertCircle />{profile.summary}</p></article>
    <section className="health-grid">{profile.health.map(([label, value, delta, tone]) => <article className="card health-card" key={label}><div><span>{label}</span><Delta value={delta} points /></div><strong>{value}</strong><i><b className={tone} style={{ width: `${value}%` }} /></i><small>{Math.abs(delta)} point {delta >= 0 ? "improvement" : "decline"}</small></article>)}</section>
    <section className="decision-grid"><article className="cause-panel"><div className="insight-label">Explain · Cause hypotheses <ShieldCheck /></div><h2>Why is value deteriorating?</h2><p>Transparent rules rank likely explanations. These are hypotheses, not verified causes.</p><div className="cause-body"><div className="cause-list">{profile.causes.map((hypothesis, index) => <button className={selectedCause.label === hypothesis.label ? "active" : ""} onClick={() => setCause(hypothesis.label)} key={hypothesis.label}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{hypothesis.label}</strong><small>{hypothesis.strength}</small></span><em>{hypothesis.confidence.toFixed(2)}</em></button>)}</div><div className="evidence"><div className="support"><h3><CheckCircle2 />Supporting evidence</h3>{selectedCause.supporting.map((item) => <p key={item.text}><strong>{item.text}</strong><span>{item.source} · {item.timestamp}</span></p>)}</div><div className="contradict"><h3><XCircle />Contradictory evidence</h3>{selectedCause.contradicting.length ? selectedCause.contradicting.map((item) => <p key={item.text}><strong>{item.text}</strong><span>{item.source} · {item.timestamp}</span></p>) : <p><strong>No contradiction recorded</strong><span>Rule engine · current run</span></p>}</div></div></div><footer><span>Rule <strong>cause-v1.5</strong></span><span>Generated <strong>21:42</strong></span><span>Threshold <strong>0.45</strong></span></footer></article>
    <article className="card action-card"><SectionTitle eyebrow="Decide" title="Recommended action" action={<Badge severity={account.severity} />} /><div className="action-hero"><span><LifeBuoy /></span><div><strong>{profile.action.recommended}</strong><p>{profile.action.description}</p></div></div><div className="utility"><div><span>Benefit</span><strong>{profile.action.benefit}</strong></div><div><span>Friction</span><strong>{profile.action.friction}</strong></div><div><span>Risk</span><strong>{profile.action.risk}</strong></div></div><div className="checks">{profile.action.checks.map((check) => <span key={check}><Check />{check}</span>)}</div><div className="rejected"><small>Rejected by policy</small>{profile.action.rejected.map((item) => <p key={item.name}><X /><span><strong>{item.name}</strong>{item.reason}</span></p>)}</div><button className="primary full">{profile.action.approvalRequired ? "Request approval" : "Start mock action"} <ArrowRight /></button></article></section>
    <article className="card timeline"><SectionTitle eyebrow="Unified history" title="Account timeline" action={<button className="period">All events <ChevronDown /></button>} />{profile.timeline.map((event) => { const Icon = timelineIcons[event.tone]; return <div className="timeline-row" key={event.title}><span className={`event-icon ${event.tone}`}><Icon /></span><div><strong>{event.title}</strong><small>{event.meta}</small></div><MoreHorizontal /></div>; })}</article></div>
  </section></>;
}

function Approvals() {
  const requests = churnProfiles.filter((profile) => profile.action.approvalRequired);
  const [selected, setSelected] = useState(0); const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const profile = requests[selected] ?? requests[0]; const account = getAccount(profile.accountId);
  return <section className="approval-layout"><article className="card approval-list"><SectionTitle eyebrow="Pending review" title={`${requests.length} governed requests`} action={<button className="icon-btn"><Filter /></button>} /><label className="search"><Search /><input placeholder="Search approvals" /></label>{requests.map((request, index) => { const requestAccount = getAccount(request.accountId); return <button className={selected === index ? "active" : ""} onClick={() => { setSelected(index); setDecision("pending"); }} key={request.accountId}><Avatar account={requestAccount} small /><span><strong>{requestAccount.name}</strong><small>{request.action.recommended}</small><em>{request.churnType}</em></span><b>{request.probability}%</b></button>; })}</article>
  <article className="card approval-detail"><div className="approval-head"><SectionTitle eyebrow={`Action request · INT-${2841 + selected}`} title={profile.action.recommended} detail={`${account.name} · ${profile.churnType} · Submitted by policy engine`} /><Badge severity={account.severity} risk={profile.probability} /></div>{decision === "pending" ? <><div className="context-grid"><div><span>Owner</span><strong>{account.owner}</strong></div><div><span>MRR</span><strong>{account.mrr}</strong></div><div><span>Renewal</span><strong>{account.renewal}</strong></div><div><span>Freshness</span><strong className="positive"><CheckCircle2 />{account.freshness}</strong></div></div><div className="approval-reason"><h3><ShieldCheck />Why this needs review</h3><p>{profile.action.approvalReason}</p><ul>{profile.action.checks.map((check) => <li key={check}><Check />{check}</li>)}</ul></div><blockquote><small>Decision context</small>“{profile.summary} Recommended response: {profile.action.description}”<cite>Template explanation · deterministic mock data</cite></blockquote><div className="approval-actions"><button className="danger" onClick={() => setDecision("rejected")}><X />Reject</button><button className="secondary"><Menu />Modify</button><button className="primary" onClick={() => setDecision("approved")}><Check />Approve action</button></div></> : <div className={`decision-result ${decision}`}>{decision === "approved" ? <CheckCircle2 /> : <XCircle />}<h3>Action {decision}</h3><p>The mock decision was recorded locally. Refreshing resets this state.</p><button className="secondary" onClick={() => setDecision("pending")}>Undo mock decision</button></div>}</article></section>;
}

function Outcomes() {
  return <><section className="kpi-grid"><Kpi label="Acceptance rate" value="72%" delta={8.1} note="36 of 50 recommendations" icon={ThumbsUp} tone="green" /><Kpi label="Override rate" value="14%" delta={-2.4} note="Seven decisions changed" icon={ArrowRight} tone="violet" /><Kpi label="Time to action" value="4.2h" delta={-18} note="Median, last 30 days" icon={Clock3} tone="blue" /><Kpi label="Health movement" value="+6.8" delta={4.1} note="Observed after intervention" icon={TrendingUp} tone="amber" /></section><section className="chart-grid"><article className="card chart-card wide"><SectionTitle eyebrow="Workflow movement" title="Recommendation decisions" detail="Observed activity only; no causal claim." /><div className="chart"><ResponsiveContainer><BarChart data={outcomeTrend}><CartesianGrid vertical={false} stroke="#e8e8e3" /><XAxis dataKey="week" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="accepted" fill="#33483f" radius={[5,5,0,0]} /><Bar dataKey="overridden" fill="#c7c9c3" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></article><article className="card recovery"><small>Observed recovery</small><div><span className="avatar">[NL]</span><span><strong>Northstar Labs</strong><p>Support escalation · simulated</p></span></div><section><span>Health score</span><div><strong>49</strong><ArrowRight /><strong>61</strong></div><Delta value={12} points /></section><ul><li><CheckCircle2 />Severe ticket resolved</li><li><TrendingUp />Usage improved 18%</li><li><Clock3 />Observed over 14 days</li></ul><em>Simulated outcome · not causal evidence</em></article></section><article className="card queue-card"><SectionTitle eyebrow="Eight-path intervention history" title="Observed and simulated outcomes" detail="Every churn pathway has a distinct response. Changes are observations, not causal uplift." action={<button className="secondary"><Filter />Filter</button>} /><div className="table-scroll"><table className="data-table"><thead><tr><th>Churn pathway</th><th>Account</th><th>Final action</th><th>Status</th><th>Response</th><th>Usage Δ</th><th>Health Δ</th></tr></thead><tbody>{churnProfiles.map((profile) => { const account = getAccount(profile.accountId); return <tr key={profile.accountId}><td><strong>{profile.churnType}</strong></td><td>{account.name}</td><td>{profile.action.recommended}</td><td><span className="badge badge-low"><i />{profile.outcome.status}</span></td><td>{profile.outcome.response}<small>{profile.outcome.observation}</small></td><td>{profile.outcome.usageDelta}</td><td><strong className="positive">{profile.outcome.healthDelta}</strong></td></tr>; })}</tbody></table></div></article></>;
}

function Audit() {
  const [expanded, setExpanded] = useState("AUD-9031");
  const rows = churnProfiles.map((profile, index) => ({ id: `AUD-${9031 - index}`, time: `21:${String(42 - index * 3).padStart(2, "0")}:08`, actor: profile.action.approvalRequired ? "Policy engine" : "Decision engine", account: getAccount(profile.accountId), profile, entity: `INT-${2841 - index}` }));
  const selected = rows.find((row) => row.id === expanded) ?? rows[0];
  return <article className="card queue-card"><div className="queue-tools"><div className="tabs"><button className="active">All events</button><button>Decisions</button><button>Approvals</button><button>Data</button></div><div className="tool-actions"><label className="search"><Search /><input placeholder="Search actors or entities" /></label><button className="secondary"><Filter />Filters</button></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Account</th><th>Action</th><th>Entity</th><th>Version</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={expanded === row.id ? "selected" : ""} onClick={() => setExpanded(expanded === row.id ? "" : row.id)}><td><strong>{row.time}</strong><small>18 Jul 2026</small></td><td>{row.actor}</td><td>{row.account.name}</td><td><strong>{row.profile.churnType} recommendation created</strong></td><td><code>{row.entity}</code></td><td><span className="version">policy-v2.4</span></td><td><ChevronDown className={expanded === row.id ? "rotated" : ""} /></td></tr>)}</tbody></table></div>{expanded && <div className="audit-diff"><header><ShieldCheck /><span><strong>Decision change · {expanded}</strong><small>{selected.account.name} · immutable event record</small></span><button className="icon-btn" onClick={() => setExpanded("")}><X /></button></header><div><section><span>Before</span><pre>{`{\n  "recommendation": null,\n  "approval_status": null\n}`}</pre></section><section><span>After</span><pre>{JSON.stringify({ churn_pathway: selected.profile.churnType, recommendation: selected.profile.action.recommended, approval_status: selected.profile.action.approvalRequired ? "csm_review" : "eligible", rule_version: "policy-v2.4" }, null, 2)}</pre></section></div></div>}</article>;
}

export function ValueLoopApp({ initialScreen, initialAccountId = "northstar" }: { initialScreen: Screen; initialAccountId?: string }) {
  const router = useRouter(); const screen = initialScreen; const [mobile, setMobile] = useState(false); const [fresh, setFresh] = useState(false);
  const activeAccount = getAccount(initialAccountId); const activeProfile = getChurnProfile(activeAccount.id);
  const select = (s: Screen, accountId?: string) => { router.push(s === "account" ? `/accounts/${accountId ?? activeAccount.id}` : routes[s]); setMobile(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const h: [string, string, string] = screen === "account" ? [`Account / ${activeAccount.name}`, "Customer 360", `${activeProfile?.churnType ?? "Account"}: unified value, risk, evidence, decisions, and activity.`] : headings[screen];
  return <div className="shell"><a className="skip-link" href="#main-content">Skip to main content</a><aside className={cx("sidebar", mobile && "open")}><div className="brand"><span><Activity /></span><div><strong>ValueLoop</strong><small>Customer intelligence</small></div><button aria-label="Close navigation" onClick={() => setMobile(false)}><X /></button></div><nav aria-label="Primary navigation"><small>Workspace</small>{nav.map(([id, label, Icon]) => <button key={id} aria-current={screen === id || screen === "account" && id === "accounts" ? "page" : undefined} className={screen === id || screen === "account" && id === "accounts" ? "active" : ""} onClick={() => select(id)}><Icon /><span>{label}</span>{id === "approvals" && <b>{churnProfiles.filter((profile) => profile.action.approvalRequired).length}</b>}</button>)}</nav><div className="sidebar-foot"><button className="fresh-card" onClick={() => setFresh(!fresh)}><span><Database /></span><div><strong>Sources healthy</strong><small>Updated 8 min ago</small></div><ChevronRight /></button>{fresh && <div className="fresh-pop"><strong>Demo data is current</strong><p>All four sources passed validation.</p><button onClick={() => setFresh(false)}>Run mock refresh</button></div>}<div className="user"><span>AR</span><div><strong>Aisha Rahman</strong><small>Customer Success Manager</small></div><MoreHorizontal aria-hidden="true" /></div></div></aside>{mobile && <button className="scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}
  <main id="main-content"><header className="topbar"><button aria-label="Open navigation" className="menu" onClick={() => setMobile(true)}><Menu /></button><div className="crumb"><LayoutDashboard /><span>Workspace</span><ChevronRight /><strong>{screen === "account" ? activeAccount.name : h[1]}</strong></div><div className="top-actions"><label><span className="sr-only">Search accounts</span><Search /><input aria-label="Search accounts" placeholder="Search accounts..." /><kbd>⌘ K</kbd></label><button aria-label="View notifications" className="icon-btn notify"><Bell /><i /></button><button aria-label="Change reporting date" className="period">18 Jul 2026 <ChevronDown /></button></div></header><div className="page"><header className="page-head"><div><span>{h[0]}</span><h1>{h[1]}</h1><p>{h[2]}</p></div>{screen === "overview" && <button className="primary" onClick={() => select("risk")}><Gauge />Open risk queue</button>}{screen === "risk" && <button className="secondary"><Database />Refresh analysis</button>}{screen === "audit" && <button className="secondary"><ShieldCheck />Manager view</button>}</header>
  {screen === "overview" && <Overview openAccount={(accountId) => select("account", accountId)} openRisk={() => select("risk")} />}{screen === "risk" && <Queue openAccount={(accountId) => select("account", accountId)} />}{screen === "accounts" && <Queue openAccount={(accountId) => select("account", accountId)} directory />}{screen === "account" && <Customer360 accountId={activeAccount.id} back={() => select("accounts")} />}{screen === "approvals" && <Approvals />}{screen === "outcomes" && <Outcomes />}{screen === "audit" && <Audit />}</div></main></div>;
}
