---
title: "ValueLoop - Master Product, Architecture and Implementation Blueprint"
version: "1.0"
date: "2026-07-18"
status: "Internal build document"
context: "Hack Attack 3.0 - Case Study 2"
---

# ValueLoop

## Master Product, Architecture and Implementation Blueprint

*Detailed internal specification for project initialization, implementation, testing, and demo preparation.*

> **Product thesis**
>
> Do not merely predict churn. Detect value loss, explain the likely cause, recommend the safest next-best action, and learn from the outcome.

| Field | Definition |
|---|---|
| Context | Hack Attack 3.0 - Case Study 2 |
| Primary user | Customer Success Manager in a small-to-mid-sized B2B SaaS company |
| Prototype scale | Up to 50 seeded demo accounts |
| Document purpose | Source of truth for `/init`, repository planning, coding agents, and team execution |
| Status | Detailed working blueprint; not constrained by submission page limits |

**Version 1.0 - 18 July 2026**


> **Internal-use note**
>
> This document consolidates the detailed PRD, implementation blueprint, prototype design, Case Study 2 requirements, and judging considerations. Public-facing statistics and competitor claims must be independently verified before submission or publication.

# Document map

1. [Executive summary and product positioning](#1-executive-summary-and-product-positioning)
2. [Problem, users and value proposition](#2-problem-users-and-value-proposition)
3. [Scope, non-goals and success definition](#3-scope-non-goals-and-success-definition)
4. [End-to-end user journeys](#4-end-to-end-user-journeys)
5. [Functional requirements](#5-functional-requirements)
6. [Data model and seeded demo dataset](#6-data-model-and-seeded-demo-dataset)
7. [Analytics, health and machine-learning design](#7-analytics-health-and-machine-learning-design)
8. [Cause-hypothesis engine](#8-cause-hypothesis-engine)
9. [Next-best-action policy engine](#9-next-best-action-policy-engine)
10. [Explanation and optional LLM layer](#10-explanation-and-optional-llm-layer)
11. [System architecture and technology stack](#11-system-architecture-and-technology-stack)
12. [API specification](#12-api-specification)
13. [Frontend information architecture and screens](#13-frontend-information-architecture-and-screens)
14. [Security, privacy and governance](#14-security-privacy-and-governance)
15. [Observability, testing and reliability](#15-observability-testing-and-reliability)
16. [Implementation roadmap and team execution](#16-implementation-roadmap-and-team-execution)
17. [Demo script and judging alignment](#17-demo-script-and-judging-alignment)
18. [Business model and validation plan](#18-business-model-and-validation-plan)
19. [Risks, assumptions and open decisions](#19-risks-assumptions-and-open-decisions)
20. [Repository `/init` instructions and definition of done](#20-repository-init-instructions-and-definition-of-done)
21. [Appendices](#appendix-a-example-policy-configuration)

> **How to use this document**
>
> Use Sections 1-3 to align the team, Sections 4-15 to build, Section 16 to plan work, Section 17 to rehearse the demo, and Section 20 as the context supplied to a coding agent during repository initialization.

# 1. Executive summary and product positioning

ValueLoop is an explainable subscription-value intelligence and next-best-action platform. It unifies product usage, billing, support, feedback, contracts and customer goals into a Customer 360 profile. It then detects deteriorating value or subscription risk, produces evidence-backed cause hypotheses, filters possible interventions through deterministic policy rules, routes sensitive actions for human approval, and records outcomes for later evaluation.

> **Central architectural principle**
>
> A deterministic control plane surrounds probabilistic intelligence. Models and LLMs may advise, but policies, permissions and human approvals control execution.

## 1.1 Why ValueLoop is different

- Focuses on customer value realization, not only churn prevention.
- Provides separate risk outputs for cancellation, downgrade, inactivity, payment failure and expansion readiness.
- Treats rule-derived causes as hypotheses with confidence, evidence, contradictory signals and an Unknown state.
- Allows customer-friendly actions such as downgrade, pause and no action, rather than forcing retention.
- Uses deterministic eligibility and safety rules before any AI-based ranking.
- Captures recommendation, approval, delivery, response and subsequent outcomes to close the loop.

![Governed closed-loop workflow: Detect, Explain, Decide, Approve, Act, Measure](ValueLoop_Master_Implementation_Blueprint_assets/media/image1.png)

Figure 1. Governed closed-loop workflow: **Detect → Explain → Decide → Approve → Act → Measure**.

## 1.2 Prototype promise

The prototype demonstrates the mechanism and user experience using seeded or synthetic data. It does not claim production-grade predictive accuracy, verified causal inference, or autonomous execution of real customer actions.

# 2. Problem, users and value proposition

## 2.1 Problem statement

Subscription businesses often store customer signals in separate systems. A CSM may need to inspect product analytics, billing records, support tickets, CRM notes and feedback manually. By the time the pattern becomes obvious, the customer may already be disengaged, under-utilizing the plan, experiencing repeated failures or entering cancellation.

## 2.2 Primary and secondary users

| **Persona**              | **Need**                                             | **Primary workflow**                                         |
|--------------------------|------------------------------------------------------|--------------------------------------------------------------|
| Customer Success Manager | Prioritize accounts and understand what changed      | Risk queue → account evidence → approve or modify action |
| Support Lead             | Find technical or experience-driven risk             | Review escalations and verify resolution                     |
| Finance/Billing          | Recover involuntary churn                            | Payment-failure queue and retry status                       |
| Product Manager          | Understand product-fit and adoption patterns         | Segment analysis and feature adoption                        |
| Manager/Executive        | Track at-risk revenue and intervention effectiveness | Outcome dashboard and audit review                           |

## 2.3 Value proposition

| **Stakeholder** | **Value delivered**                                                            |
|-----------------|--------------------------------------------------------------------------------|
| CSM             | Less manual investigation, clearer prioritization, evidence and next steps     |
| Customer        | More relevant support, transparent plan choices and less over-contact          |
| Business        | Earlier intervention, lower avoidable revenue leakage and measurable workflows |
| Risk/Governance | Traceable decisions, approvals, model versions and audit logs                  |

# 3. Scope, non-goals and success definition

## 3.1 MVP scope

- CSV upload and seeded demo data for accounts, subscriptions, users, usage, payments, support, feedback and interventions.
- Customer 360 profile with a unified event timeline and data-quality indicators.
- Five health dimensions: Adoption, Engagement, Experience, Financial and Value.
- Risk scoring for cancellation, downgrade, inactivity, payment failure and expansion readiness.
- Ranked cause hypotheses with evidence, confidence and contradictory signals.
- Policy-controlled next-best-action registry with approval rules and frequency caps.
- Risk dashboard, account detail, explanation panel, approval inbox, cancellation simulation and outcome dashboard.
- Intervention, override, approval, delivery and outcome logging.

## 3.2 Explicit non-goals

- Replacing CRM, billing, support or marketing systems.
- Guaranteeing churn, renewal or intervention success.
- Letting an LLM alter plans, charge cards, issue refunds or contact customers without policy checks.
- Claiming causal uplift without randomized or credible controlled testing.
- Hiding downgrade, pause or cancellation options.
- Building Kafka, Kubernetes, a lakehouse, enterprise MDM or full MLOps during the hackathon.

## 3.3 Build priorities

| **Priority** | **Feature**                       | **Demonstration level**                      |
|--------------|-----------------------------------|----------------------------------------------|
| Must         | Customer risk queue               | Fully working                                |
| Must         | Customer 360 account page         | Fully working                                |
| Must         | Five health dimensions            | Working with seeded data                     |
| Must         | Risk score and evidence           | Working                                      |
| Must         | Cause hypotheses                  | Rule-based and explainable                   |
| Must         | Next-best-action policy engine    | 5-8 actions                                  |
| Must         | Approval and intervention logging | Fully working                                |
| Should       | Outcome dashboard                 | At least one outcome and one override metric |
| Optional     | LLM paraphrasing                  | Template fallback required                   |
| Optional     | Cancellation simulation           | Only after the core flow is stable           |

## 3.4 Acceptance summary

1. Load at least 50 seeded accounts without manual database editing.
2. Every account displays source freshness, five health dimensions, risk outputs and evidence.
3. Demonstrate all eight reviewed churn pathways: Value, Experience, Product-fit, Price, Involuntary, Competitive, Lifecycle and Silent churn.
4. Allow multiple hypotheses or Unknown for ambiguous cases.
5. Pass all actions through a fixed registry and policy filter.
6. Require approval for sensitive actions.
7. Continue functioning when the optional LLM is unavailable.
8. Store every recommendation and final action in intervention and audit records.

# 4. End-to-end user journeys

## 4.1 Proactive CSM journey

1. CSM opens the dashboard and sees accounts ranked by risk, at-risk MRR and urgency.
2. CSM selects an account and reviews health dimensions, signal changes, source freshness and timeline.
3. Risk service shows separate probabilities and top contributing features.
4. Cause engine returns ranked hypotheses with supporting and contradictory evidence.
5. Policy engine filters the action registry and explains rejected actions.
6. Action ranker recommends the safest useful option.
7. CSM approves, modifies or rejects the recommendation and records a reason.
8. The action is simulated or logged, and later outcomes update the dashboard.

## 4.2 Reactive cancellation journey

1. Customer begins cancellation or downgrade flow.
2. System requests a transparent reason without obstructing cancellation.
3. Customer profile and latest evidence are recalculated.
4. Policy engine may offer support, plan review, downgrade, pause or direct cancellation.
5. Customer retains control; no dark pattern or forced retention is used.
6. Chosen path and subsequent outcome are logged.

## 4.3 Seeded demonstration case

| **Field**             | **Example**                                                             |
|-----------------------|-------------------------------------------------------------------------|
| Account               | Northstar Labs                                                          |
| At-risk MRR           | RM 8.2k                                                                 |
| Risk                  | 86% cancellation risk                                                   |
| Evidence              | Usage down 42%; 2 unresolved high-severity tickets; payment healthy     |
| Hypotheses            | Technical/Support 0.76; Disengagement 0.58                              |
| Rejected actions      | Payment recovery - no payment evidence; upgrade - poor experience score |
| Recommended action    | Escalate to senior support                                              |
| Approval              | CSM approval required for outreach; escalation task can be created      |
| Expected demo outcome | Ticket resolved, usage improves, health score rises                     |

![ValueLoop customer value recovery dashboard mock-up](ValueLoop_Master_Implementation_Blueprint_assets/media/image2.png)

Figure 2. Prototype dashboard mock-up used as the target information hierarchy.

# 5. Functional requirements

| **ID**                              | **Requirement**                                                                                                                                      |
|-------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| FR-01 Customer 360 and data quality | One account profile; account-user hierarchy; source, freshness, missing fields, duplicate confidence and last ingestion; timestamped event timeline. |
| FR-02 Multi-dimensional health      | Calculate and display Adoption, Engagement, Experience, Financial and Value scores with direct evidence.                                             |
| FR-03 Baselines                     | Compare customers with their own historical pattern when possible; use segment baselines otherwise; label synthetic history.                         |
| FR-04 Risk models                   | Produce separate risk outputs; show confidence, model version, timestamp and top contributors; allow rules fallback.                                 |
| FR-05 Cause hypotheses              | Rank Value Realization, Payment, Technical/Support, Product Fit, Price/Plan Fit, Competitive, Disengagement, Lifecycle and Unknown; include evidence and contradictions. |
| FR-06 Next-best action              | Filter fixed actions using eligibility, consent, frequency, state, safety and approval rules before ranking.                                         |
| FR-07 Proactive/reactive workflows  | Use the same Customer 360 and policy engine for dashboard alerts and cancellation/downgrade flows.                                                   |
| FR-08 Outcome tracking              | Record recommendation, approver, final action, channel, status, customer response, usage delta, renewal, downgrade or churn.                         |
| FR-09 Auditability                  | Record user/system actor, timestamp, entity, action, previous state, new state and reason.                                                           |
| FR-10 Roles                         | Support CSM and manager roles in the prototype; finance/support roles may be represented by seeded permissions.                                      |

## 5.1 Core user stories

- US-01: As a CSM, I see accounts ranked by risk and at-risk revenue.
- US-02: As a CSM, I see which signals changed rather than only a score.
- US-03: As a finance user, I separate payment-related risk from dissatisfaction-driven risk.
- US-04: As a CSM, I receive an action with eligibility, expected benefit, risk and approval status.
- US-05: As a user, I can override a recommendation and store a reason.
- US-06: As a manager, I can see delivered interventions and observed outcomes.
- US-07: As an auditor, I can see who viewed, approved, changed or executed an action.

# 6. Data model and seeded demo dataset

## 6.1 Core entities

| **Entity**             | **Key fields**                                                                                       |
|------------------------|------------------------------------------------------------------------------------------------------|
| accounts               | account_id, name, segment, industry, plan, arr_mrr, start_date, renewal_date, owner_id               |
| users                  | user_id, account_id, role, seat_status, created_at                                                   |
| subscriptions          | subscription_id, account_id, plan, price, status, renewal_date, cancel_at                            |
| usage_events           | event_id, account_id, user_id, feature, timestamp, count, duration                                   |
| payment_events         | payment_id, account_id, timestamp, status, amount, attempt, failure_code                             |
| support_tickets        | ticket_id, account_id, severity, category, opened_at, closed_at, sentiment, resolution               |
| feedback_events        | feedback_id, account_id, metric_type, score, text, timestamp                                         |
| health_scores          | account_id, timestamp, adoption, engagement, experience, financial, value, overall, version          |
| risk_predictions       | account_id, risk_type, probability, confidence, top_features_json, model_version, predicted_at       |
| cause_hypotheses       | account_id, cause, rank, confidence, evidence_json, contradictions_json, generated_at                |
| action_recommendations | account_id, action_code, eligibility, rejection_reason, utility_score, approval_required             |
| interventions          | intervention_id, account_id, recommended_action, final_action, approver, status, channel, created_at |
| outcomes               | intervention_id, renewed, downgraded, churned, usage_delta, health_delta, response                   |
| audit_logs             | actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, timestamp             |

## 6.2 Seeded dataset design

- 50 accounts across low, medium and high-risk bands.
- At least one deterministic account for each reviewed churn pathway, plus broader payment, support, adoption, fit, price, competitive and normal-variance coverage.
- At least 5 ambiguous accounts with conflicting evidence and multiple hypotheses.
- At least 5 positive expansion-readiness accounts.
- At least 8 intervention histories with different statuses and outcomes.
- All longitudinal history clearly marked synthetic.

## 6.3 Data quality rules

| **Rule**                   | **Response**                              |
|----------------------------|-------------------------------------------|
| Missing account identifier | Reject row and report line number         |
| Unknown foreign key        | Quarantine row                            |
| Duplicate event ID         | Keep first valid record and log duplicate |
| Future timestamp           | Flag as invalid                           |
| Missing optional field     | Store null and reduce data-quality score  |
| Stale source               | Show warning in UI                        |
| Sensitive ticket text      | Mask in default views                     |

# 7. Analytics, health and machine-learning design

## 7.1 Health dimensions

| **Dimension** | **Example features**                                      | **Prototype approach**          |
|---------------|-----------------------------------------------------------|---------------------------------|
| Adoption      | core feature use, seat activation, time-to-first-value    | Weighted rules normalized 0-100 |
| Engagement    | active days, login trend, campaign/training response      | Trend and recency score         |
| Experience    | ticket severity, unresolved duration, CSAT/NPS, sentiment | Penalty-based score             |
| Financial     | payment failures, renewal proximity, price/usage fit      | Rules and recency               |
| Value         | customer goal completion or proxy outcomes                | Goal/proxy completion score     |

Overall health may be a weighted summary for sorting, but the UI must always show the five components and evidence. Suggested prototype weights: Adoption 25%, Engagement 20%, Experience 20%, Financial 20%, Value 15%. Store the scoring version.

## 7.2 Risk strategy

- Baseline: logistic regression for transparency and calibration.
- Primary tabular candidate: XGBoost only when it materially improves validation.
- Explainability: SHAP plus direct event evidence and rules.
- Class imbalance: class weighting and precision-recall metrics.
- Thresholds: business-cost matrix rather than a default probability threshold.
- Validation: temporal split when real history exists; stratified split for synthetic demonstration.
- Fallback: deterministic risk rules when confidence or data quality is low.

## 7.3 Metrics

| **Category** | **Metrics**                                                |
|--------------|------------------------------------------------------------|
| Model        | precision, recall, PR-AUC, calibration, confusion matrix   |
| Operational  | data freshness, analysis latency, explanation coverage     |
| Workflow     | recommendation acceptance, override rate, time to action   |
| Customer     | health change, activation, ticket reduction                |
| Business     | renewal, downgrade, involuntary recovery, at-risk revenue  |
| Experiment   | incremental retention/uplift only after controlled testing |

# 8. Cause-hypothesis engine

The prototype must not claim a supervised cause classifier unless verified labels exist. The cause engine is a transparent rule system supported by model evidence.

| **Hypothesis**    | **Illustrative evidence**                                    | **Contradictory evidence**       |
|-------------------|--------------------------------------------------------------|----------------------------------|
| Value Realization | agreed outcomes remain incomplete, low time-to-value         | high goal completion             |
| Payment           | failed attempts, expiry risk, payment status past due        | payments current and no failures |
| Technical/Support | high severity, repeat tickets, long unresolved duration      | no tickets or rapid resolution   |
| Product Fit       | core feature not used, adoption remains low after onboarding | high goal completion             |
| Price/Plan Fit    | low utilization relative to plan, price objections           | near limits and high value       |
| Competitive       | named alternative, confirmed feature or policy gap           | no competitor signal             |
| Disengagement     | declining active days and logins                             | stable value outcomes            |
| Lifecycle         | seasonality, temporary pause, known project end              | persistent negative experience   |
| Unknown           | insufficient or conflicting signals                          | n/a                              |

## 8.1 Rule output contract

- cause_code and human-readable label
- confidence from 0 to 1
- rank
- supporting evidence array with source, timestamp and value
- contradictory evidence array
- rule_version
- generated_at
- unknown_reason when no hypothesis meets threshold

## 8.2 Example rule

IF payment_failures_30d \>= 2 AND subscription_status != cancelled THEN Payment confidence = min(0.95, 0.60 + 0.10 \* payment_failures_30d).

# 9. Next-best-action policy engine

Decisioning is staged: eligibility → safety → utility scoring → explanation → approval/execution → outcome capture.

![Action registry and guardrails table](ValueLoop_Master_Implementation_Blueprint_assets/media/image3.png)

## 9.1 Action registry

| **Action**             | **Trigger**                          | **Automatic in demo** | **Approval/guardrail**                 |
|------------------------|--------------------------------------|-----------------------|----------------------------------------|
| Guided onboarding      | Value outcomes not reached           | Yes                   | Frequency cap, goal context and opt-out |
| Payment reminder/retry | Failed payment evidence              | Mock only             | Finance policy; no real charge         |
| Support escalation     | Severe or repeated unresolved ticket | Create task           | Owner and priority required            |
| Alternative workflow   | Confirmed product-fit gap            | No                    | Show limitations and direct exit       |
| Human outreach         | High risk or ambiguity               | No                    | CSM approval and contact preference    |
| Flexible plan review   | Persistent under-utilization         | No                    | Show lower tier, usage plan, pause, exit |
| Differentiation review | Named competitor and verified gap    | No                    | No invented claims or coercive terms   |
| Pause subscription     | Temporary lifecycle inactivity       | No                    | Customer consent and transparent terms |
| Upgrade review         | Near limits and strong value         | No                    | Not when experience is poor            |
| No action              | Normal variance or low confidence    | Yes                   | Prevents over-contact                  |

## 9.2 Utility score

Suggested prototype formula: utility = expected_benefit \* success_probability - action_cost - customer_friction - execution_risk. Every component is normalized and stored for explanation. Policy eligibility always overrides utility ranking.

# 10. Explanation and optional LLM layer

- Generate structured explanations from stored evidence first.
- Use templates as the reliable default and fallback.
- Optional LLM may paraphrase only the structured explanation.
- Never allow the LLM to invent evidence, select ineligible actions or execute an action.
- Cache successful explanations and apply latency timeout.
- Display model/rule version, evidence timestamps and confidence.

> **Example explanation**
>
> Northstar Labs is high risk because product usage fell 42% and two high-severity tickets remain unresolved. Payment activity is healthy, so payment recovery was rejected. The safest recommended action is senior support escalation, followed by human outreach if the issue remains unresolved.

# 11. System architecture and technology stack

## 11.1 Hackathon architecture

| **Layer**      | **Technology**                     | **Purpose**                                            |
|----------------|------------------------------------|--------------------------------------------------------|
| Frontend       | Next.js + Tailwind CSS             | Dashboard, account pages, approvals, cancellation flow |
| Charts         | Recharts                           | Health trends, risk breakdowns and KPIs                |
| Backend        | FastAPI                            | Customer, prediction, action and outcome endpoints     |
| Database       | Supabase PostgreSQL                | Customer 360, events, scores, actions, audit           |
| Authentication | Supabase Auth                      | CSM and manager roles                                  |
| Storage        | Supabase Storage                   | CSV uploads and model artifacts                        |
| Processing     | pandas                             | Validation, cleaning and feature engineering           |
| ML             | scikit-learn or XGBoost            | Risk models                                            |
| Explainability | SHAP                               | Model evidence                                         |
| Rules          | Python + JSON/YAML policies        | Cause and action decisioning                           |
| LLM            | Optional API                       | Paraphrasing only                                      |
| Deployment     | Vercel + Supabase                  | Managed web, FastAPI function, and platform hosting    |
| Scheduling     | APScheduler or cron                | Periodic recalculation                                 |

![Detailed hackathon prototype system architecture](ValueLoop_Master_Implementation_Blueprint_assets/media/image4.png)

Figure 3. Detailed hackathon prototype architecture.

## 11.2 Module boundaries

| **Module**    | **Responsibilities**                                     |
|---------------|----------------------------------------------------------|
| ingestion     | CSV parsing, schema validation, deduplication, freshness |
| customer360   | profile assembly, timeline, data quality                 |
| features      | point-in-time feature generation                         |
| health        | dimension scoring and evidence                           |
| risk          | model inference, confidence and SHAP                     |
| causes        | rule evaluation and ranked hypotheses                    |
| policy        | eligibility, safety, frequency caps, approvals           |
| actions       | utility scoring and recommendation                       |
| explanations  | templates, optional LLM, cache                           |
| interventions | approval, override, simulated execution                  |
| outcomes      | post-action metrics and feedback                         |
| audit         | immutable activity events                                |

# 12. API specification

| **Method** | **Endpoint**                       | **Purpose**                                    |
|------------|------------------------------------|------------------------------------------------|
| POST       | /api/v1/ingestion/csv              | Upload and validate CSV                        |
| GET        | /api/v1/ingestion/jobs/{id}        | Ingestion status and errors                    |
| GET        | /api/v1/accounts                   | Risk-sorted account list                       |
| GET        | /api/v1/accounts/{id}              | Customer 360 summary                           |
| GET        | /api/v1/accounts/{id}/timeline     | Unified event timeline                         |
| GET        | /api/v1/accounts/{id}/health       | Latest health dimensions and evidence          |
| POST       | /api/v1/accounts/{id}/analyze      | Recalculate features, risk, causes and actions |
| GET        | /api/v1/accounts/{id}/risks        | Risk outputs and contributors                  |
| GET        | /api/v1/accounts/{id}/causes       | Cause hypotheses                               |
| GET        | /api/v1/accounts/{id}/actions      | Eligible and rejected actions                  |
| POST       | /api/v1/interventions              | Create recommendation/approval record          |
| PATCH      | /api/v1/interventions/{id}         | Approve, reject, modify or execute             |
| POST       | /api/v1/interventions/{id}/outcome | Record observed outcome                        |
| GET        | /api/v1/dashboard/kpis             | Risk, revenue, action and outcome KPIs         |
| GET        | /api/v1/audit                      | Authorized audit query                         |

## 12.1 Standard response envelope

```json
{
  "data": {},
  "meta": {
    "request_id": "...",
    "generated_at": "...",
    "version": "v1"
  },
  "errors": []
}
```

## 12.2 Error behavior

| **Code** | **Meaning**                                                |
|----------|------------------------------------------------------------|
| 400      | Validation failure                                         |
| 401      | Unauthenticated                                            |
| 403      | Role not permitted                                         |
| 404      | Entity not found                                           |
| 409      | State conflict or duplicate                                |
| 422      | Valid JSON but invalid business rule                       |
| 500      | Unexpected service error; return safe message              |
| 503      | Optional model/LLM unavailable; use deterministic fallback |

# 13. Frontend information architecture and screens

| **Route**      | **Screen**         | **Key content**                                            |
|----------------|--------------------|------------------------------------------------------------|
| /              | Overview dashboard | KPIs, risk distribution, freshness, priority queue         |
| /risk-queue    | Risk queue         | Filters, graph/table views, churn pathways, leading issues, at-risk MRR and urgency |
| /accounts/{id} | Customer 360       | Profile, health, timeline, risks, causes, actions          |
| /approvals     | Approval inbox     | Sensitive pending actions, evidence, approve/modify/reject |
| /outcomes      | Outcome dashboard  | Interventions, acceptance, overrides, observed deltas      |
| /audit         | Audit log          | Actor, action, object, timestamp and reason                |
| /data          | Data ingestion     | Upload, mapping, validation report and freshness           |

## 13.1 Account page layout

1. Header: account name, plan, MRR, renewal date, owner and data freshness.
2. Health row: five component cards with trend and evidence count.
3. Risk panel: separate risks, confidence and top contributors.
4. Cause case file: ranked hypotheses with supporting and contradictory signals on a light evidence surface.
5. Action panel: recommended action, eligible alternatives, rejected actions and approval status.
6. Timeline: usage, payment, support, feedback and intervention events.
7. Audit strip: latest decision version and actor.

## 13.2 UX and accessibility requirements

- Keyboard navigable controls and visible focus states.
- Semantic headings, labels and table headers.
- Charts must have text summaries and tooltips.
- Never rely on color alone for risk level.
- Consistent terms for risk, hypothesis, recommendation, approval and outcome.
- Confirmation before sensitive changes; reason required for overrides.

# 14. Security, privacy and governance

| **Area**          | **Requirement**                                               |
|-------------------|---------------------------------------------------------------|
| Authentication    | Supabase Auth; no anonymous dashboard access                  |
| Authorization     | Role-based access; manager-only audit and sensitive approvals |
| Secrets           | Environment variables; never commit keys                      |
| Transport         | TLS in deployed environments                                  |
| Data minimization | Store only required demo fields                               |
| Sensitive text    | Mask support text by default                                  |
| Retention         | Document demo-data deletion and reset procedure               |
| Consent           | Respect contact preferences and opt-out flags                 |
| Audit             | Log views and all recommendation/approval/execution changes   |
| Model governance  | Store model/rule versions and prediction timestamps           |
| Human control     | Sensitive actions require explicit approval                   |

## 14.1 Ethical guardrails

- No dark patterns in cancellation.
- No discriminatory prioritization solely by account value.
- No upgrade recommendation when experience is poor.
- No payment action without observable payment evidence.
- No forced single cause when evidence is ambiguous.
- No causal claims from observational prototype data.

# 15. Observability, testing and reliability

| **Requirement** | **Acceptance criterion**                                                                           |
|-----------------|----------------------------------------------------------------------------------------------------|
| Performance     | Dashboard under 3 seconds for 50 accounts; account analysis under 2 seconds excluding optional LLM |
| Reliability     | Cached/template explanation and deterministic action fallback                                      |
| Logging         | Structured request, ingestion, prediction, policy and intervention logs                            |
| Monitoring      | Error rate, latency, data freshness and model response time                                        |
| Reproducibility | Pinned dependencies, model version, seed, data dictionary and README                               |
| Testing         | Unit, integration, policy, API and end-to-end tests                                                |

## 15.1 Minimum test suite

- CSV validation rejects malformed required fields and reports row errors.
- Health scores remain within 0-100.
- Low-confidence account can return Unknown.
- Payment action is rejected without payment evidence.
- Upgrade is rejected when experience score is poor.
- Frequency cap prevents repeated outreach.
- Sensitive action cannot execute without approval.
- LLM timeout returns template explanation.
- Every state change creates an audit event.
- End-to-end seeded account completes dashboard → analysis → approval → outcome.

# 16. Implementation roadmap and team execution

## 16.1 Recommended phases

| **Phase**                     | **Deliverables**                                    | **Exit condition**                |
|-------------------------------|-----------------------------------------------------|-----------------------------------|
| 0\. Repository initialization | Monorepo, env examples, linting, README, CI         | All services start locally        |
| 1\. Data foundation           | Schema, seed generator, CSV ingestion, Customer 360 | 50 accounts load and render       |
| 2\. Intelligence              | Features, health, baseline risk, SHAP, cause rules  | Northstar case explains correctly |
| 3\. Decisioning               | Action registry, policy engine, approval states     | Ineligible actions are rejected   |
| 4\. Product UI                | Dashboard, account page, approvals, outcomes        | Core journey works end-to-end     |
| 5\. Hardening                 | Auth, audit, error handling, tests, cache           | Demo survives optional failures   |
| 6\. Demo preparation          | Seed reset, script, backup video, README            | Five-minute rehearsal is stable   |

## 16.2 Suggested repository structure

valueloop/  
apps/web/  
services/api/  
packages/ui/  
packages/shared-types/  
ml/models/  
ml/notebooks/  
policies/actions.yaml  
policies/cause_rules.yaml  
data/seeds/  
scripts/seed_demo.py  
tests/  
docs/  
docker-compose.yml  
.env.example  
README.md

## 16.3 Team workstreams

| **Workstream** | **Primary responsibility**                               |
|----------------|----------------------------------------------------------|
| Frontend       | Navigation, dashboard, account, approvals and outcome UI |
| Backend/Data   | Schema, ingestion, APIs, Customer 360 and audit          |
| ML/Decisioning | Features, health, risk, SHAP, cause and action rules     |
| Product/Demo   | Seed scenarios, copy, testing, documentation and video   |

# 17. Demo script and judging alignment

## 17.1 Five-minute flow

| **Time**  | **Demo step**                                                  |
|-----------|----------------------------------------------------------------|
| 0:00-0:35 | Explain fragmented customer data and late intervention problem |
| 0:35-1:00 | State ValueLoop thesis and governed closed loop                |
| 1:00-1:35 | Open dashboard and select Northstar Labs                       |
| 1:35-2:25 | Show five health dimensions, risk and source evidence          |
| 2:25-3:10 | Show cause hypotheses and contradictory evidence               |
| 3:10-4:00 | Show eligible/rejected actions and approval                    |
| 4:00-4:30 | Approve escalation and show intervention log                   |
| 4:30-5:00 | Show outcome KPI, differentiation and future plan              |

## 17.2 Rubric alignment

| **Criterion**       | **Evidence to show**                                               |
|---------------------|--------------------------------------------------------------------|
| Concept formulation | Clear problem, exact workflow, feasible MVP                        |
| Innovativeness      | Cause-aware governed closed loop; customer-friendly alternatives   |
| Methodology         | Transparent health, risk, SHAP, hypotheses, policies and fallbacks |
| Design              | Polished dashboard and clear account journey                       |
| Market potential    | Defined buyer, ICP, value and validation plan                      |
| Final live demo     | Reliable seeded scenario, backup and confident Q&A                 |

## 17.3 Likely judge questions

- How is this different from a churn dashboard?
- How do you know the cause is correct?
- Why use an LLM at all?
- What happens when data is missing?
- How do you avoid harmful or excessive outreach?
- What evidence proves business impact?
- Can this scale beyond 50 accounts?
- What did the team actually build versus simulate?

# 18. Business model and validation plan

## 18.1 Ideal customer profile

B2B SaaS companies with recurring revenue, multiple customer-data systems and a Customer Success function. The initial buyer is likely a Head of Customer Success, COO or SaaS founder; CSMs are the main daily users.

## 18.2 Commercial model hypothesis

| **Tier**   | **Target**            | **Illustrative packaging**                                              |
|------------|-----------------------|-------------------------------------------------------------------------|
| Starter    | Small CS teams        | Limited managed accounts, CSV ingestion, core risk and action workflows |
| Growth     | Scaling SaaS          | More accounts, integrations, approvals and outcome analytics            |
| Enterprise | Governed environments | SSO, custom policies, advanced audit, data connectors and support       |

Pricing must remain a hypothesis until customer interviews and willingness-to-pay validation are completed. Do not present invented demand evidence.

## 18.3 Validation activities

1. Interview 3-5 CSMs, SaaS founders or support leaders.
2. Validate the current investigation workflow and time spent per risky account.
3. Test whether users trust evidence-backed hypotheses and rejected-action explanations.
4. Test which outcomes matter: saved time, faster response, involuntary recovery or renewal.
5. Test preferred pricing unit: managed accounts, CSM seats, MRR band or integrations.
6. Record quotes and findings with participant consent; distinguish evidence from assumptions.

![Indicative customer success platform market growth chart](ValueLoop_Master_Implementation_Blueprint_assets/media/image5.png)

Figure 4. Indicative market-growth visual from the proposal; verify and cite the underlying source before public use.

# 19. Risks, assumptions and open decisions

![Success metrics and risks and mitigations tables](ValueLoop_Master_Implementation_Blueprint_assets/media/image6.png)

| **Risk**                        | **Mitigation**                                                    |
|---------------------------------|-------------------------------------------------------------------|
| Synthetic/snapshot data         | Label clearly; separate mechanism demo from accuracy claims       |
| Heuristic cause labels          | Use hypothesis language, confidence, contradictions and Unknown   |
| LLM hallucination               | Structured evidence, whitelist, templates and no direct execution |
| Over-contact                    | Frequency caps, preferences and no-action option                  |
| Bias toward high-value accounts | Audit service quality by segment                                  |
| Dark-pattern retention          | Transparent downgrade, pause and cancellation                     |
| Model drift                     | Store versions and define future monitoring                       |
| Data leakage                    | RBAC, masking, minimum necessary data and audit                   |

## 19.1 Open decisions to resolve before coding freeze

- Choose logistic regression only or include XGBoost.
- Finalize exact health weights and risk thresholds.
- Choose five to eight actions for the demo registry.
- Decide whether cancellation simulation is in scope.
- Choose optional LLM provider or template-only mode.
- Define which actions require manager versus CSM approval.
- Confirm final seeded accounts and expected outputs.
- Confirm deployment path and fallback local demo.

# 20. Repository /init instructions and definition of done

> **Purpose**
>
> The following is a compact implementation brief that can be pasted into a coding agent or used as the repository initialization contract.

## 20.1 /init brief

Build ValueLoop as a hackathon-ready modular monolith with a Next.js/Tailwind frontend, FastAPI backend and Supabase PostgreSQL/Auth/Storage. Use seeded synthetic data for 50 B2B SaaS accounts. Implement Customer 360, five health dimensions, separate risk outputs, SHAP or transparent feature evidence, ranked cause hypotheses, a deterministic next-best-action policy engine, approval workflow, intervention/outcome logging and audit logs. Models and LLMs only advise; policies and humans control execution. Use templates as the explanation fallback. Do not claim verified causes or causal uplift. Prioritize a reliable end-to-end Northstar Labs demo over broad integrations.

## 20.2 Engineering constraints

- Keep services modular but deployable as one backend.
- Use typed request/response schemas and centralized configuration.
- No secrets in source control.
- All database changes through migrations.
- All policy rules stored in versioned JSON/YAML or Python configuration.
- Every prediction and decision stores a version and timestamp.
- Every failure path has a safe user-facing response.
- The demo must work without an external LLM.
- Provide deterministic seed reset and one-command local setup.

## 20.3 Definition of done

1. Fresh clone can be configured from README and .env.example.
2. One command seeds 50 accounts and expected demo scenarios.
3. Core API and frontend start successfully.
4. Northstar Labs completes the full **Detect → Explain → Decide → Approve → Act → Measure** flow.
5. At least one ambiguous account returns multiple hypotheses or Unknown.
6. At least one payment account receives payment recovery and one non-payment account rejects it.
7. At least one sensitive action is blocked until approval.
8. LLM disabled mode displays a complete template explanation.
9. Automated tests cover policy and critical end-to-end behavior.
10. No critical errors in browser console or backend logs during the demo.
11. Architecture, data limitations, model version and demo accounts are documented.

# Appendix A. Example policy configuration

```yaml
actions:
  support_escalation:
    requires:
      - unresolved_high_severity_ticket
    approval: false
    max_per_30d: 3

  human_outreach:
    requires:
      - contact_allowed
    approval: csm
    max_per_14d: 1

  upgrade_review:
    requires:
      - expansion_readiness_high
      - experience_score_gte_70
    approval: csm_customer

  no_action:
    automatic: true
```

# Appendix B. Example analysis response

```json
{
  "account_id": "northstar-labs",
  "health": {
    "adoption": 38,
    "engagement": 44,
    "experience": 29,
    "financial": 91,
    "value": 51
  },
  "risks": [
    {
      "type": "cancellation",
      "probability": 0.86,
      "confidence": 0.79
    }
  ],
  "causes": [
    {
      "cause": "technical_support",
      "confidence": 0.76
    },
    {
      "cause": "disengagement",
      "confidence": 0.58
    }
  ],
  "recommended_action": "support_escalation",
  "rejected_actions": [
    "payment_recovery",
    "upgrade_review"
  ],
  "approval_required": false
}
```

# Appendix C. Visual architecture reference

![ValueLoop future-state enterprise architecture reference](ValueLoop_Master_Implementation_Blueprint_assets/media/image7.png)

The enterprise-oriented architecture remains a future-state reference. The implementation should follow the simpler prototype architecture in Section 11.

# Appendix D. Source and honesty notes

- This blueprint consolidates the detailed ValueLoop PRD, added execution priorities, business gaps and visual proposal assets.
- Figures taken from the working proposal are included for internal planning.
- Market numbers and competitor claims must be verified with current primary sources before public submission.
- Synthetic histories, heuristic labels and simulated outcomes must always be labeled clearly.
