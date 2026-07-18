# ValueLoop Frontend Design Specification

> **Status:** Approved for frontend mockup implementation  
> **Scope:** Frontend mockup only. No backend, database, authentication, live ML, or external API integration.

## 1. Design Direction

ValueLoop should feel like a calm, trustworthy decision workspace—not a generic admin template or an alarming churn dashboard. The visual composition combines:

- **Customer Success Dashboard:** dense, sortable risk queue and account prioritization;
- **PulsePay:** crisp subscription, MRR, renewal, and payment KPI treatment;
- **Daft Studio Customer Analytics:** fixed sidebar, pale canvas, rounded white cards, compact charts, and profile-led Customer 360 layout;
- **Dark Customer Experience Dashboard:** high-contrast cause, evidence, and recommendation panels.

The supplied reference influences visual language and composition only. Its social profile, interests, spending categories, campaigns, and brand-preference features must not be copied.

## 2. Experience Principles

1. **Evidence before recommendation:** every risk and action links visibly to supporting signals.
2. **Calm urgency:** risk is easy to scan without flooding the interface with red.
3. **Human control:** approval state and override actions are always explicit.
4. **Transparent uncertainty:** hypotheses show confidence, contradictions, and `Unknown` when appropriate.
5. **Operational clarity:** freshness, timestamps, owners, and rule/model versions remain visible.

## 3. Visual System

### Color tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F6F6F2` | Warm app background |
| Surface | `#FFFFFF` | Cards, sidebar, tables |
| Primary | `#33483F` | Active navigation, links, and chart lines |
| Primary soft | `#ECEFEA` | Active rows and navigation background |
| Ink | `#252620` | Primary text |
| Muted | `#6F716A` | Secondary text and metadata |
| Border | `#E5E4DC` | Dividers and input outlines |
| Positive | `#39765A` | Healthy state and improvement |
| Warning | `#9B6B2C` | Medium risk and stale data |
| Critical | `#A94740` | High risk and blocked state |
| Ticket | `#F2EAD4` | Selected-account risk pass |

Do not use purple text or decorative blue-violet gradients. Risk must use a label and icon in addition to color.

### Typography and shape

- Font: `Geist`, falling back to `Helvetica Neue` and `ui-sans-serif`.
- Use regular weight throughout. Establish hierarchy with size, spacing, case, and tabular or monospaced details rather than bold text.
- Page title: 24–28 px; card title: 14–16 px; body: 14 px.
- Large KPI: 28–34 px with tabular numerals.
- Card radius: 16 px; control radius: 10 px; pill radius: 999 px.
- Border: 1 px; shadow: `0 8px 24px rgba(16, 24, 40, 0.05)`.
- Base spacing: 4 px scale; main card gaps: 16 px; page padding: 24 px.

### Charts

Charts use thin charcoal-green lines, flat muted fills, minimal grid lines, and direct labels. Tooltips show value, date, and context. Every chart includes a visible summary sentence for accessibility.

## 4. Application Shell

The desktop canvas targets 1440 px and uses a fixed 224 px left sidebar. The content area uses a 12-column grid with a maximum readable width around 1600 px.

### Left navigation

```text
ValueLoop mark
Overview
Risk Queue
Accounts
Approvals        [count]
Outcomes
Audit Log
------------------------
Data freshness status
Demo user / role
```

The active item uses a soft blue rounded background and dark label. Navigation collapses to an icon rail on medium screens and a drawer on mobile.

### Top bar

Each page has breadcrumbs, a page title, global account search, a date-range control, and a compact demo-user menu. Data upload is not a primary navigation item; a mock upload/refresh action is opened from the freshness card.

## 5. Screen Specifications

### 5.1 Overview

The overview answers: *Where is value deteriorating, which account needs attention first, and why?*

```text
┌────────┬────────┬────────┬────────┐
│At-risk │High-risk│Action  │Data    │
│MRR     │accounts │accept. │freshness│
└────────┴────────┴────────┴────────┘
┌─────────────────────────┬──────────────┐
│ Priority account table  │ Selected     │
│                         │ account      │
│                         │ insight      │
└─────────────────────────┴──────────────┘
┌─────────────────────────┬──────────────┐
│ Risk / MRR trend        │ Action mix   │
└─────────────────────────┴──────────────┘
```

KPI cards show current value, direction, comparison period, and a one-line interpretation. The priority table includes account, owner, MRR, primary risk, probability, health movement, renewal date, freshness, and recommended action. Selecting a row updates the right-side insight panel without leaving the page.

The selected Northstar Labs panel is a warm paper “risk pass” inspired by a movie ticket. It uses a serial header, dashed perforation, side notches, monospaced metadata, and an action stub while showing cancellation risk, the top two hypotheses, three evidence bullets, rejected-action reasons, and the recommended support escalation.

### 5.2 Risk Queue

Use a full-width operational table with sticky headers. Filters include search, segment, owner, churn pathway, severity, renewal window, freshness, and approval state. A compact coverage board and saved-view strip expose Value, Experience, Product-fit, Price, Involuntary, Competitive, Lifecycle, and Silent churn.

Each risk probability is paired with confidence and a text severity. Row expansion reveals top contributors and the current recommendation. The primary action opens the account; secondary actions allow mock assignment or acknowledgement.

### 5.3 Accounts

Provide a searchable account directory using a compact table by default and an optional card view. Show plan, MRR, owner, renewal, overall health, highest risk, latest intervention, and freshness. The page is for finding accounts; it must not duplicate the detailed Risk Queue workflow.

### 5.4 Customer 360

Customer 360 borrows the profile-led hierarchy of the supplied reference but replaces consumer analytics with ValueLoop evidence.

```text
┌──────────────┬────────────────────────────────┐
│ Account      │ Subscription + risk trend      │
│ profile      ├────────────────────────────────┤
│ subscription │ Five health dimensions         │
│ freshness    ├────────────────┬───────────────┤
│              │ Cause panel    │ Recommended   │
│              │ + evidence     │ action        │
│              ├────────────────┴───────────────┤
│              │ Unified event timeline         │
└──────────────┴────────────────────────────────┘
```

The profile column shows account name, segment, plan, MRR, renewal date, owner, contact permission, and source freshness. The main header shows separate risk chips rather than one blended risk score.

Five health cards display Adoption, Engagement, Experience, Financial, and Value scores from 0–100, direction, and evidence count. The risk chart defaults to cancellation but can switch among risk types.

The dark cause panel contains ranked hypotheses with confidence bars. Selecting a hypothesis reveals two clearly separated lists: **Supporting evidence** and **Contradictory evidence**, each with source and timestamp. The action card shows the recommendation, expected benefit, customer friction, approval requirement, eligible alternatives, and rejected actions with reasons.

The event timeline combines usage, billing, support, feedback, decisions, interventions, and outcomes. Event types use icons and labels, not color alone.

### 5.5 Approvals

Use a two-pane inbox: pending items on the left and a detailed evidence review on the right. The reviewer can approve, modify, or reject in the mock UI. Modify/reject requires a reason. The detail view includes account context, recommendation, policy checks, risks, freshness, and audit preview. A confirmation dialog prevents accidental approval.

### 5.6 Outcomes

Top cards show recommendation acceptance, override rate, time to action, and observed health change. Below, use an intervention trend chart and an outcome table showing account, action, approval, delivery status, customer response, usage delta, health delta, and renewal outcome. Label all results as observed or simulated; never imply causal uplift.

### 5.7 Audit Log

Use a dense, filterable table with timestamp, actor, role, account, action, entity, version, and reason. Expanding a row shows a readable before/after comparison. Manager-only status is represented visually in the mockup, without implementing authentication.

## 6. Components

Build the later frontend from reusable primitives: `AppShell`, `SidebarNav`, `PageHeader`, `KpiCard`, `StatusBadge`, `RiskChip`, `HealthCard`, `TrendChart`, `AccountTable`, `InsightPanel`, `HypothesisList`, `EvidenceList`, `ActionCard`, `ApprovalPanel`, `EventTimeline`, `AuditDiff`, `EmptyState`, and `SkeletonCard`.

All components need default, hover, focus, selected, loading, empty, error, and disabled states in the mockup where relevant.

## 7. Frontend Mock Data and Interactions

The approved mockup uses local deterministic fixtures only. Include one account for each of the eight reviewed churn pathways—Value, Experience, Product-fit, Price, Involuntary, Competitive, Lifecycle, and Silent—plus one healthy expansion-ready account. Every churn fixture includes hypotheses, supporting and contradictory evidence, a policy-safe recommendation, rejected alternatives, timeline events, and a simulated or observed outcome.

Mock interactions should support navigation, account selection, filters, chart tooltips, hypothesis selection, expandable evidence, approval dialogs, and simulated state changes. Refreshing the page may reset state. No request should call a real backend.

## 8. Responsive and Accessibility Requirements

- Desktop-first, functional down to 1024 px; mobile stacks cards and converts tables to prioritized rows.
- Full keyboard navigation, visible focus rings, semantic landmarks, labels, and table headers.
- Minimum 4.5:1 body-text contrast and 44 px touch targets for primary controls.
- Charts require text summaries; risk and health states require text/icon reinforcement.
- Motion is restrained to 150–220 ms fades, panel transitions, and chart reveals; honor reduced-motion preferences.

## 9. Review Checklist

Before frontend implementation, confirm:

- light warm-neutral analytics shell with charcoal-green accents and no purple text;
- six-item primary navigation and placement of the data refresh/upload utility;
- Overview table-to-insight interaction;
- Customer 360 information density and panel order;
- exact KPI labels, risk labels, and demo copy;
- desktop-first responsive approach;
- ticket treatment and regular-weight typography across the overview.

This approval authorizes only the static frontend mockup. Backend behavior, authentication, database work, production ML, and external integrations remain out of scope.
