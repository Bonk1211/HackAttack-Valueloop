# Subscription-Value Risk Prediction using Explainable Machine Learning

**A ValueLoop technical report — modelled on the structure of Maan & Maan,
*"Customer Churn Prediction Model using Explainable Machine Learning"*, IJCST
Vol. 11 Issue 1 (2023).**

Project: ValueLoop — Hack Attack 3.0, Case Study 2
Scope: the risk-prediction subsystem (`ml/` + `services/api/app/modules/risk.py`)

---

## Abstract

Retaining an existing subscriber is far cheaper than acquiring a new one, yet the
signals that precede value loss are scattered across product usage, billing,
support and feedback systems. ValueLoop predicts five subscription risks —
cancellation, downgrade, inactivity, payment failure and expansion readiness —
with a pair of ensemble-friendly classifiers (Logistic Regression and Extreme
Gradient Boosting, "XGBoost") trained per risk type. The winning model is selected
per risk by held-out PR-AUC, probabilities are calibrated, and every prediction is
explained through per-feature attribution (XGBoost native SHAP values / LR
coefficients). Because no verified real churn labels exist at prototype stage, the
models are trained on a **synthetic population whose labels are generated from
latent drivers** — deliberately noisier and richer than the deterministic rules the
model replaces, so the model learns to recover signal rather than memorise a rule.
A deterministic rules engine is retained as an always-available fallback so the
product degrades safely when a model artifact is unavailable. This report documents
the dataset, methodology, features, evaluation and results.

---

## I. Introduction

Subscription businesses lose revenue not only through outright cancellation but
through quieter forms of value erosion: falling usage, plan downgrades, involuntary
payment failure and disengagement. A Customer Success Manager (CSM) typically has
to inspect several disconnected systems to understand *why* an account is
deteriorating, and by the time the pattern is obvious the customer may already be
disengaged.

ValueLoop's risk subsystem addresses this by producing, per account, five separate
calibrated risk probabilities together with the features that drove each one. In
line with the growing demand for **transparency and interpretability** in ML
decisioning, no prediction is emitted without an accompanying, feature-level
explanation, and the surrounding product enforces a deterministic policy layer so
that a model only ever *advises* — it never executes an action on its own.

The objective is not merely to predict a churn flag, but to (a) separate distinct
risk types, (b) rank each account's risks so a CSM knows what to act on first, and
(c) explain each score with evidence a human can audit.

---

## II. Key Challenges

- **No verified labels.** At prototype scale only a handful of observed intervention
  outcomes exist; there is no large, trustworthy churn-labelled history to train on.
- **Circularity risk.** The subsystem being replaced is a set of deterministic
  formulas. Naively labelling accounts with those same formulas would make the model
  re-learn the rules — an impressive-looking but hollow result.
- **Class imbalance.** Real churn events are the minority class; accuracy is a
  misleading metric.
- **Explainability.** Stakeholders will not trust an opaque score; each prediction
  must expose the features that produced it.
- **Graceful degradation.** The live product must keep functioning when a model
  artifact is missing or stale.
- **Multiple targets.** Five distinct risks must be modelled, each with its own
  signal and base rate.

---

## III. Background Study and Literature Survey

The reference work (Maan & Maan, 2023) compares Logistic Regression, Decision Tree,
Random Forest and XGBoost on a public telecom churn dataset, selecting the most
performant model and emphasising explainability through feature importance and ROC
analysis. The broader literature (e.g. Umayaparvathi et al.) stresses that early,
*actionable* identification of likely churners — rather than post-hoc detection — is
what delivers business value.

ValueLoop adopts the same "train several candidates, select the most optimal,
explain the outcome" philosophy, and extends it in three ways relevant to a
subscription-value product:

1. **Multi-risk** rather than a single binary churn flag (five risk heads).
2. **Calibrated probabilities** (Platt scaling) so the scores are comparable and
   meaningful, not merely rank-ordered.
3. **A deterministic control plane** around the probabilistic model — policies and
   human approvals gate any action.

---

## IV. Dataset for Training and Analysis

Unlike the reference paper's public telecom dataset, ValueLoop has no verified
churn-labelled customer history at prototype stage. Training therefore uses a
**programmatically generated synthetic population** (`ml/synth.py`), designed so a
model can learn genuine structure:

- **Size / determinism:** 4,000 synthetic accounts, fixed seed 42 (reproducible).
- **Latent drivers:** each account is sampled with continuous latent states —
  `decline`, `ticket_load`, `pay_trouble`, `dissat`, `lowadopt`, `renewal_near`,
  plus two red-herring drivers that influence events but never any label.
- **Events, not labels, from drivers:** the drivers generate raw event streams
  (usage, payments, support tickets, feedback, subscription) via the same builders
  that produce the 50-account demo seed, so synthetic rows share the production
  schema.
- **Labels from a richer generator:** each risk label is sampled from a logistic
  function of the latent drivers with **interaction terms and per-account Gaussian
  noise** — structurally richer and noisier than the deterministic formulas the model
  replaces. Features are extracted from the *events*, giving the model a **noisy
  projection** of the latent state to learn from (anti-circularity).

The 50-account demo seed (`data/seeds/`) is used **only for inference/demonstration**
and is never part of training.

Resulting positive (event) rates per risk type are realistic and imbalanced:

| Risk type | Positive rate |
|---|---|
| cancellation | 0.40 |
| downgrade | 0.34 |
| inactivity | 0.32 |
| payment_failure | 0.37 |
| expansion_readiness | 0.31 |

---

## V. Methodology

Multiple algorithms fit this problem domain; the most optimal is selected per risk
type by comparing held-out performance — the same comparative approach as the
reference paper, adapted to five targets.

### A. Data Pre-processing

- **Point-in-time aggregation.** Raw per-event rows are aggregated to one feature
  vector per account as of a reference timestamp `now` (`ml/features.py`). `now` is
  an explicit parameter so training is deterministic and inference is testable.
- **Type / temporal normalisation.** Timestamps are parsed to timezone-aware UTC;
  date-only fields (e.g. `renewal_date`) are normalised so time arithmetic is safe.
- **Missing-value defaults.** Accounts with no feedback default to a neutral score
  (5.0); empty event lists yield zeroed counts rather than errors.
- **Scaling.** For Logistic Regression, features are standardised
  (`StandardScaler`) inside the model pipeline; XGBoost is scale-invariant and uses
  raw features.

### B. Feature Extraction & Selection

Nine features are engineered from the event streams and frozen in a fixed order
(`FEATURE_ORDER`) that is stored inside every model artifact to prevent silent
drift:

| # | Feature | Meaning |
|---|---|---|
| 1 | `recent_usage` | usage events in the last 30 days |
| 2 | `usage_trend_30d` | recent-30d minus prior-30d usage (negative = declining) |
| 3 | `open_critical_tickets` | unresolved critical support tickets |
| 4 | `open_high_tickets` | unresolved high-severity tickets |
| 5 | `pay_failures_30d` | failed payments in the last 30 days |
| 6 | `avg_feedback` | mean feedback score (neutral default) |
| 7 | `days_to_renewal` | days until subscription renewal |
| 8 | `adoption_ratio` | share of usage on the core workflow feature |
| 9 | `export_share` | share of usage on the exports feature |

The same extractor runs in **both** training and live inference, guaranteeing
train/serve parity. Feature *selection* is intentionally minimal (all nine retained);
recursive elimination is noted as future work, as in the reference paper.

### C. Train-Test Data Split

Each risk type is split **stratified** into train / calibration / test at
**64% / 16% / 20%**. The calibration slice is held out from base-estimator fitting so
probability calibration is not optimistic. For XGBoost, a further internal split
provides an early-stopping evaluation set. (The reference paper used a 70/30 split;
ValueLoop adds a dedicated calibration fold because it emits calibrated
probabilities.)

### D. Metrics for Model Evaluation

- **PR-AUC (average precision)** — primary selection metric, appropriate for
  imbalanced positive classes.
- **Base-rate comparison** — a model must beat the positive base rate (the no-skill
  baseline) to demonstrate real signal.
- **Calibration** — Platt/sigmoid scaling (`CalibratedClassifierCV`) so predicted
  probabilities are meaningful, not merely ordered.
- **Class-imbalance handling** — `class_weight="balanced"` (LR) and
  `scale_pos_weight = neg/pos` (XGBoost).
- **Feature attribution** — per-prediction contributions via XGBoost native SHAP
  values (`pred_contribs`) or LR coefficient × standardised value.

---

## VI. Solution Approach

The subsystem is deliberately built as a **selectable ensemble with an explainable,
safely-degrading serving path**:

1. **Two candidates per risk type.** Logistic Regression (interpretable baseline,
   strong at cold-start / small tenants) and XGBoost (captures the driver
   interactions that dominate at scale).
2. **Per-risk model selection.** For each of the five risks, the model with the
   higher held-out PR-AUC wins and is persisted as
   `ml/models/risk_<type>_v1.joblib`, tagged `"<type>-<algo>-v1"`.
3. **Calibrated, explained inference.** At serving time the shared extractor builds
   the feature vector; the model emits a calibrated probability, a confidence derived
   from distance to the decision boundary, and a ranked `top_features_json`
   attribution.
4. **Deterministic fallback.** If an artifact is missing or its feature order drifts,
   the loader raises `ModelUnavailable` and the service falls back to the original
   deterministic rules, tagged `"<type>-rules-fallback"` — the product never fails to
   return a risk.
5. **Governed control plane.** The model only advises; downstream policy rules and
   human approvals control any action (unchanged by this work).

This mirrors the reference paper's emphasis on a "highly performance-optimised and
highly responsible" model that explains its decisions, extended with an explicit
fallback for production reliability.

---

## VII. Experimental Results

### A. Performance Analysis and Key Metrics

Held-out PR-AUC per risk type (synthetic test set, 20% stratified hold-out), versus
the positive base rate and the selected winner:

| Risk type | LR PR-AUC | XGBoost PR-AUC | Base rate | Winner |
|---|---|---|---|---|
| cancellation | 0.639 | **0.641** | 0.388 | XGBoost |
| downgrade | **0.501** | 0.470 | 0.341 | Logistic Regression |
| inactivity | **0.482** | 0.440 | 0.324 | Logistic Regression |
| payment_failure | **0.597** | 0.565 | 0.375 | Logistic Regression |
| expansion_readiness | **0.492** | 0.475 | 0.312 | Logistic Regression |

**Reading the results honestly:**

- **Every model beats its base rate**, confirming the classifiers learn real signal
  rather than the label generator — the anti-circularity design worked.
- **Scores are modest (PR-AUC ≈ 0.48–0.64)**, which is expected and appropriate:
  substantial Gaussian noise was injected into the labels, so a near-perfect score
  would itself be a red flag for leakage.
- **Logistic Regression wins four of five risk types** at this data scale; XGBoost
  wins only `cancellation`, the risk with the strongest driver interaction. This is
  the genuine outcome of training both and selecting per type — not a foregone
  conclusion — and it demonstrates why the comparative approach matters. XGBoost is
  expected to lead as tenant data volume grows.

**Explainability.** For each prediction the model returns the top contributing
features. Example (a ticketed, healthy-usage account, cancellation head, XGBoost):
`open_high_tickets`, `recent_usage`, `open_critical_tickets` surface as the leading
contributors — directly auditable evidence in the spirit of the reference paper's
XGBoost feature-importance analysis.

**Ranking on demo accounts.** On the (inference-only) demo seed the trained models
rank each account's risks sensibly — e.g. a repeatedly-failing-payment account leads
with `payment_failure`, and a healthy account leads with `expansion_readiness` —
without reproducing the retired rule thresholds.

**Reliability.** Removing model artifacts triggers the deterministic fallback with a
truthful `*-rules-fallback` provenance tag; empty accounts are handled without error.
Static analysis, the hermetic unit suite, and dedicated ML tests (determinism, label
balance, PR-AUC-beats-base-rate, artifact round-trip) all pass.

---

## VIII. Conclusions and Future Work

ValueLoop implements an explainable, multi-risk prediction subsystem that trains
Logistic Regression and XGBoost per risk type, selects the stronger by PR-AUC,
calibrates its probabilities, and attributes every prediction to specific features —
with a deterministic rules fallback for production safety. The comparative,
interpretability-first methodology follows the reference paper while extending it to
five calibrated risk heads and a safely-degrading serving path.

**Stated limitations (in the interest of honesty):**

- **Synthetic training data only.** Results demonstrate the *mechanism*, not
  production accuracy or causal uplift. Numbers must not be presented as validated on
  real customers.
- **No temporal validation.** A stratified split is used; temporal back-testing
  awaits real history.
- **Minimal feature selection.** All nine features are retained; recursive feature
  elimination and richer features (e.g. seasonality, cohort baselines) are future
  work.

**Future work:**

1. Retrain on real, labelled churn history and add temporal (walk-forward) validation.
2. Expand the feature set and add recursive feature elimination / importance-based
   pruning.
3. Monitor calibration drift and automate periodic retraining.
4. Promote XGBoost to primary as per-tenant data volume grows; retain LR for
   cold-start.

---

## References

1. J. Maan and H. Maan, "Customer Churn Prediction Model using Explainable Machine
   Learning," *International Journal of Computer Science Trends and Technology
   (IJCST)*, Vol. 11, Issue 1, Jan–Feb 2023. (Template/reference for this report.)
2. V. Umayaparvathi and K. Iyakutti, "A Survey on Customer Churn Prediction in
   Telecom Industry."
3. ValueLoop Master Product, Architecture and Implementation Blueprint, v1.0, 2026
   (§7 Analytics/ML design, §12.2 fallback behaviour).
4. Implementation artifacts: `ml/` (features, synth, train, registry, explain),
   `services/api/app/modules/risk.py`, `ml/models/metrics.json`.
