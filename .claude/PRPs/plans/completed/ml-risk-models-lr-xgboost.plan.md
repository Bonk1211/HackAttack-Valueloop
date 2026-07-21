# Plan: ML Risk Models — Logistic Regression + XGBoost with SHAP

## Summary
Replace the hand-tuned deterministic formulas in `risk.py` with a real trained-ML
pipeline: two model families (interpretable Logistic Regression baseline + XGBoost
primary) trained per risk type on a **large synthetic population**, calibrated,
explained via SHAP/coefficients, and wired into the existing `RiskPrediction`
contract. Deterministic rules stay as the low-confidence / model-unavailable fallback.

## User Story
As a **Customer Success Manager**, I want risk scores produced by a trained,
calibrated model with feature-attributed explanations, so that the "decision-agent"
label reflects genuine learned prediction rather than a fixed formula — and so the
same pipeline scales to a real customer warehouse.

## Problem → Solution
**Current:** `risk.py` returns 5 risks from hardcoded linear formulas
(`0.3 + 0.25*open_critical + ...`), `model_version="1.0"` is a string literal, no
model artifact, no training, no learned weights.
**Desired:** `ml/` trains LR + XGBoost per risk type on a 3–5k-account synthetic
population with stochastic labels, selects the better model by held-out PR-AUC,
calibrates probabilities, serializes artifacts, and `risk.py` loads them for
inference with SHAP-based `top_features_json`. Rules remain the fallback.

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A (blueprint §7.2 / §11.1 / §16.2 provide the spec)
- **PRD Phase**: N/A — standalone
- **Estimated Files**: ~12 (7 create, 5 update)

---

## UX Design

### Before / After
**Internal change — no user-facing UX transformation.** The frontend already renders
`probability`, `confidence`, `top_features_json`, `model_version` from
`/api/v1/accounts/{id}/risks`. Field shapes are unchanged; only their provenance and
values change. `model_version` will read e.g. `cancellation-xgb-v1` instead of `1.0`.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `GET /accounts/{id}/risks` | formula output | model inference (rules fallback) | same JSON shape |
| `model_version` field | `"1.0"` | `"<type>-<algo>-v1"` or `"<type>-rules-fallback"` | provenance now truthful |
| `top_features_json` | 1 hardcoded feature | ranked SHAP/coef contributions | richer, still `[{feature,value}]` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `services/api/app/modules/risk.py` | 1-79 | The module being replaced; exact return contract + persist pattern to preserve |
| P0 | `services/api/app/models/domain.py` | 83-91 | `RiskPrediction` schema — the fixed output contract |
| P0 | `scripts/seed_demo.py` | 1-230 | `gen_usage_events`/`gen_payment_events`/`gen_support_tickets`/`gen_feedback_events`/`build_bundle` — reuse verbatim for synthetic population |
| P1 | `services/api/app/modules/causes.py` | 45-84 | `_features()` — feature-extraction-from-raw-events pattern to mirror |
| P1 | `services/api/tests/test_risks.py` | 1-36 | Threshold assertions the trained model must still satisfy for demo accounts |
| P1 | `services/api/tests/conftest.py` | 1-78 | Test fixtures, `integration` marker gating, hermetic-collection rule |
| P2 | `services/api/app/api/v1/analyze.py` | 1-24 | Orchestrator calling `predict_risks` — unchanged, confirms call signature |
| P2 | `services/api/pyproject.toml` | deps block | Where to add sklearn/xgboost/shap/joblib |

## External Documentation
| Topic | Source | Key Takeaway |
|---|---|---|
| Probability calibration | sklearn `CalibratedClassifierCV` docs | Wrap fitted classifier; `method="sigmoid"` (Platt) for small data, `"isotonic"` for larger. Fit on held-out calibration split, not train. |
| XGBoost imbalance | XGBoost `scale_pos_weight` param | Set to `neg/pos` ratio per binary target; combine with early stopping on a val set. |
| SHAP for trees | `shap.TreeExplainer` | Fast exact SHAP on boosted trees; returns per-feature contributions per row — maps directly to `top_features_json`. |
| LR explanation | sklearn `coef_` | For LR, contribution = `coef_[i] * standardized_feature_i`; no SHAP dependency needed. |

```
KEY_INSIGHT: CalibratedClassifierCV must see a split NOT used for training, or calibration is optimistic.
APPLIES_TO: Task 4 (train) — reserve a calibration slice inside the train fold.
GOTCHA: cv="prefit" requires you pass an already-fitted base estimator + a separate calibration set.

KEY_INSIGHT: SHAP TreeExplainer output is (n_rows, n_features); take abs, rank desc, keep top-k.
APPLIES_TO: Task 6 (explain) and Task 7 (inference).
GOTCHA: shap import is heavyweight (~1s cold). Import lazily inside the explainer fn, not at module top, to keep API cold-start fast.
```

---

## Patterns to Mirror

### FEATURE_EXTRACTION_FROM_RAW_EVENTS
```python
# SOURCE: services/api/app/modules/causes.py:45-84
def _features(db: Client, account_id: str) -> dict:
    usage = db.table("usage_events").select("*").eq("account_id", account_id).order("timestamp", desc=True).execute().data
    payments = db.table("payment_events").select("*").eq("account_id", account_id).execute().data
    tickets = db.table("support_tickets").select("*").eq("account_id", account_id).execute().data
    open_critical = sum(1 for t in tickets if not t.get("closed_at") and t["severity"] == "critical")
    pay_failures_30d = sum(1 for p in payments if p["status"] == "failed")
    return {"open_critical_tickets": open_critical, "payment_failures_30d": pay_failures_30d, ...}
```
> Mirror this shape, but split it: extraction must take **raw event lists** (dicts),
> not a `db` handle, so training (in-memory synthetic events) and inference (DB rows)
> share one code path.

### RISK_RETURN_CONTRACT
```python
# SOURCE: services/api/app/modules/risk.py:6-15,66-79
def _risk(risk_type, prob, conf, features=None) -> RiskPrediction:
    return RiskPrediction(
        account_id="", risk_type=risk_type,
        probability=round(max(0.0, min(1.0, prob)), 3),
        confidence=round(max(0.0, min(1.0, conf)), 3),
        top_features_json=features or [], model_version="1.0",
        generated_at=datetime.now(timezone.utc),
    )
# persist path:
if persist:
    for p in preds:
        db.table("risk_predictions").insert(p.model_dump(mode="json")).execute()
```
> Keep `_risk()` clamp helper and the `persist` insert loop **exactly**. Only the
> body that computes `prob/conf/features/model_version` changes.

### SYNTHETIC_EVENT_BUILDERS
```python
# SOURCE: scripts/seed_demo.py:150-210
def gen_usage_events(account_id, rng, user_ids, recent_count, older_count, recent_days, day_range, feature_weights): ...
def gen_payment_events(account_id, specs): ...   # specs: [(day_off, status, code, attempt, amount), ...]
def gen_support_tickets(account_id, specs): ...  # specs: [(open_off, resolve_after, sev, cat, sentiment), ...]
def build_bundle(account, cfg, rng): return users, subscription, usage, payments, tickets, feedback
```
> Import and reuse these to generate the synthetic population. Do NOT reimplement
> event generation — the shapes must match the migration + inference feature code.

### ERROR_TYPES
```python
# SOURCE: services/api/app/core/errors.py:1-23
class ApiError(Exception):
    def __init__(self, code: int, message: str): ...
# API layer already maps 503 for "optional model/LLM unavailable" per blueprint §12.2.
```
> Model-load failure inside `risk.py` must NOT raise to the user — catch and fall
> back to rules silently, logging the fallback.

### TEST_STRUCTURE
```python
# SOURCE: services/api/tests/test_risks.py:28-35 (pure unit, no db fixture)
def test_risk_probability_and_confidence_clamped():
    from app.modules.risk import _risk
    low = _risk("cancellation", -5.0, -5.0)
    assert low.probability == 0.0
```
> Unit tests that don't take `client`/`db` fixtures run hermetically (conftest skips
> live tests unless `RUN_INTEGRATION_TESTS=1`). ML training/eval tests must be
> hermetic — operate on synthetic data + saved artifacts, never touch Supabase.

### LOGGING
```python
# SOURCE: services/api/app/core/logging.py — structlog configured (JSON in prod, console in DEBUG)
# NOTE: existing modules/*.py do NOT emit logs. For the model-fallback event, add the
# first module-level structlog logger: import structlog; log = structlog.get_logger()
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `ml/__init__.py` | CREATE | Make `ml` importable (blueprint §16.2 reserves `ml/`) |
| `ml/features.py` | CREATE | Pure `extract_features(events) -> dict` shared by train + inference |
| `ml/synth.py` | CREATE | Generate 3–5k-account synthetic population + stochastic per-risk labels (reuses seed_demo builders) |
| `ml/train.py` | CREATE | Train LR + XGBoost per risk type, calibrate, select, persist artifacts + metrics.json |
| `ml/registry.py` | CREATE | `load_model(risk_type)` — cached joblib loader; raises `ModelUnavailable` |
| `ml/explain.py` | CREATE | SHAP (XGBoost) / coefficient (LR) → ranked `top_features_json` |
| `ml/models/.gitkeep` | CREATE | Artifact output dir (`risk_<type>_v1.joblib`, `metrics.json`) |
| `services/api/app/modules/risk.py` | UPDATE | Swap formula body for model inference + rules fallback; keep `_risk`, persist loop |
| `services/api/pyproject.toml` | UPDATE | Add `scikit-learn`, `xgboost`, `shap`, `joblib` to deps |
| `services/api/tests/test_risks.py` | UPDATE | `model_version` assertion (`"1.0"` → new tag); keep threshold asserts |
| `ml/tests/test_synth.py` | CREATE | Label balance + determinism of synthetic generator |
| `ml/tests/test_train_eval.py` | CREATE | Trained model beats base rate on held-out PR-AUC; artifact round-trips |
| `Makefile` | UPDATE | Add `train-ml` target (`python ml/train.py`) |

## NOT Building
- **No XGBoost-vs-LR auto-hyperparameter search** beyond a small fixed grid — one sane config each, selection by PR-AUC only.
- **No real-data ingestion / temporal backtest** — snapshot synthetic data only; temporal validation documented as future work.
- **No SHAP for the LR path** — LR uses coefficient contributions (SHAP is XGBoost-only).
- **No retraining scheduler / MLOps** (blueprint §3.2 explicitly excludes full MLOps for the hackathon).
- **No new API endpoint** — inference stays behind existing `/risks` + `/analyze`.
- **No change to causes/actions/health modules.**
- **No GPU / distributed training** — single-process CPU.

---

## Step-by-Step Tasks

### Task 1: Add ML dependencies
- **ACTION**: Add ML libs to backend deps.
- **IMPLEMENT**: In `services/api/pyproject.toml` `dependencies`, append `"scikit-learn==1.5.2"`, `"xgboost==2.1.1"`, `"shap==0.46.0"`, `"joblib==1.4.2"`. (numpy/pandas already present.)
- **MIRROR**: existing pinned-version style in the deps block.
- **IMPORTS**: n/a
- **GOTCHA**: `uv pip install -e ".[dev]"` must be re-run after editing. shap pulls `numba`/`llvmlite` — verify install succeeds on this Python (3.13). If shap wheels lag 3.13, pin `shap` to a version with cp313 wheels or gate SHAP import behind a try/except and fall back to XGBoost `feature_importances_`.
- **VALIDATE**: `cd services/api && uv pip install -e ".[dev]" && python -c "import sklearn, xgboost, shap, joblib"`

### Task 2: Shared feature extractor (`ml/features.py`)
- **ACTION**: One pure function turning raw event lists into a fixed, ordered feature vector.
- **IMPLEMENT**:
  ```python
  FEATURE_ORDER = ["recent_usage","usage_trend_30d","open_critical_tickets","open_high_tickets",
                   "pay_failures_30d","avg_feedback","days_to_renewal","adoption_ratio","export_share"]
  def extract_features(usage, payments, tickets, feedback, subscription, *, now) -> dict:
      # mirror causes._features math, but from passed-in lists (no db)
      ...
      return {k: float(v) for k in FEATURE_ORDER}  # ordered, all floats
  def to_vector(feats: dict) -> list[float]:
      return [feats[k] for k in FEATURE_ORDER]
  ```
- **MIRROR**: FEATURE_EXTRACTION_FROM_RAW_EVENTS (causes.py:45-84) — same counting logic, no `db`.
- **IMPORTS**: `from datetime import datetime`
- **GOTCHA**: `now` must be a parameter (never `datetime.now()` inside) so training is deterministic and inference is testable. Feature order is frozen — models are trained against this exact order; changing it silently breaks loaded artifacts.
- **VALIDATE**: `python -c "from ml.features import extract_features, FEATURE_ORDER; print(len(FEATURE_ORDER))"`

### Task 3: Synthetic population generator (`ml/synth.py`)
- **ACTION**: Produce N synthetic accounts with events + a stochastic churn/risk label per risk type.
- **IMPLEMENT**:
  ```python
  import random
  from ml.features import extract_features
  # reuse seed_demo builders
  import sys; sys.path.insert(0, "scripts")
  from seed_demo import gen_usage_events, gen_payment_events, gen_support_tickets, gen_feedback_events

  def _label_probs(drivers: dict) -> dict:
      # RICHER + NOISIER than risk.py: interactions + gaussian noise + red-herrings
      # e.g. cancel = logistic(1.4*ticket_sev + 1.1*usage_drop + 0.8*ticket_sev*usage_drop - 0.6 + noise)
      ...
  def make_population(n=4000, seed=42):
      rng = random.Random(seed)
      X, y = [], {t: [] for t in RISK_TYPES}
      for i in range(n):
          drivers = _sample_drivers(rng)              # ground-truth latent drivers
          events = _events_from_drivers(drivers, rng) # via seed_demo builders
          feats = extract_features(*events, now=NOW)  # noisy observed view
          probs = _label_probs(drivers)               # label from latent drivers, NOT feats
          X.append(feats)
          for t in RISK_TYPES: y[t].append(int(rng.random() < probs[t]))
      return X, y
  ```
- **MIRROR**: SYNTHETIC_EVENT_BUILDERS (seed_demo.py:150-210).
- **IMPORTS**: `random`, `ml.features`, seed_demo builders.
- **GOTCHA**: **This is the anti-circularity guard.** Labels must be sampled from the *latent drivers* through a function structurally richer than `risk.py` (interaction terms + noise + 1–2 features that don't affect the label). If labels are a deterministic function of the extracted features, the model just re-learns the extractor. Verify features are a *noisy* projection of drivers, not identical.
- **VALIDATE**: `python -c "from ml.synth import make_population; X,y=make_population(200); print(len(X), {k:sum(v) for k,v in y.items()})"` — each risk type has a non-degenerate positive rate (roughly 10–50%).

### Task 4: Train + calibrate + select (`ml/train.py`)
- **ACTION**: For each of the 5 risk types, train LR and XGBoost, calibrate, pick the PR-AUC winner, persist.
- **IMPLEMENT**:
  ```python
  from sklearn.linear_model import LogisticRegression
  from sklearn.preprocessing import StandardScaler
  from sklearn.pipeline import make_pipeline
  from sklearn.calibration import CalibratedClassifierCV
  from sklearn.metrics import average_precision_score
  from sklearn.model_selection import train_test_split
  from xgboost import XGBClassifier
  import joblib, json
  for t in RISK_TYPES:
      Xtr,Xte,ytr,yte = train_test_split(X, y[t], stratify=y[t], test_size=0.2, random_state=42)
      lr = make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=1000))
      xgb = XGBClassifier(max_depth=5, n_estimators=300, learning_rate=0.05,
                          scale_pos_weight=neg/pos, eval_metric="aucpr")
      # fit both, calibrate each on a held-out slice, score PR-AUC on Xte, keep winner
      winner, algo = pick_by_pr_auc(...)
      joblib.dump({"model": winner, "algo": algo, "features": FEATURE_ORDER, "version": f"{t}-{algo}-v1"},
                  f"ml/models/risk_{t}_v1.joblib")
  json.dump(metrics, open("ml/models/metrics.json","w"), indent=2)
  ```
- **MIRROR**: pinned deterministic style (`random_state=42`, matching seed_demo `SEED=42`).
- **IMPORTS**: sklearn, xgboost, joblib, json, `ml.synth`, `ml.features`.
- **GOTCHA**: Calibrate on a split NOT used to fit the base estimator (`cv="prefit"` + separate calibration set), else calibration is optimistic. XGBoost early stopping needs an eval set — carve one from train, not test. Save `FEATURE_ORDER` inside the artifact so inference can assert order match.
- **VALIDATE**: `python ml/train.py && ls ml/models/*.joblib && python -c "import json;m=json.load(open('ml/models/metrics.json'));print(m)"` — every risk type has PR-AUC > its positive base rate.

### Task 5: Model registry / loader (`ml/registry.py`)
- **ACTION**: Cached loader with a typed "unavailable" signal.
- **IMPLEMENT**:
  ```python
  from functools import lru_cache
  from pathlib import Path
  import joblib
  MODELS_DIR = Path(__file__).resolve().parent / "models"
  class ModelUnavailable(Exception): ...
  @lru_cache(maxsize=None)
  def load_model(risk_type: str):
      path = MODELS_DIR / f"risk_{risk_type}_v1.joblib"
      if not path.exists(): raise ModelUnavailable(risk_type)
      return joblib.load(path)  # {"model","algo","features","version"}
  ```
- **MIRROR**: `@lru_cache` singleton pattern from `config.get_settings()` (config.py:14) and `db.get_supabase()` caching.
- **IMPORTS**: `functools.lru_cache`, `joblib`, `pathlib`.
- **GOTCHA**: `lru_cache` means artifacts load once per process — retraining requires a restart (acceptable; document it). Path resolves from the module file, not CWD.
- **VALIDATE**: `python -c "from ml.registry import load_model; print(load_model('cancellation')['version'])"`

### Task 6: Explanation helper (`ml/explain.py`)
- **ACTION**: Turn a model + feature vector into ranked `top_features_json`.
- **IMPLEMENT**:
  ```python
  import numpy as np
  from ml.features import FEATURE_ORDER, to_vector
  def explain(bundle, feats: dict, k=3) -> list[dict]:
      if bundle["algo"] == "xgboost":
          import shap  # lazy
          contribs = shap.TreeExplainer(bundle["model"]).shap_values(np.array([to_vector(feats)]))[0]
      else:  # lr
          lr = bundle["model"].named_steps["logisticregression"]
          scaler = bundle["model"].named_steps["standardscaler"]
          contribs = lr.coef_[0] * scaler.transform([to_vector(feats)])[0]
      order = np.argsort(np.abs(contribs))[::-1][:k]
      return [{"feature": FEATURE_ORDER[i], "value": round(float(feats[FEATURE_ORDER[i]]),3),
               "contribution": round(float(contribs[i]),3)} for i in order]
  ```
- **MIRROR**: existing `top_features_json` shape `[{"feature":..., "value":...}]` (risk.py:67) — extended with `contribution`, still a superset the frontend tolerates.
- **IMPORTS**: `numpy`, lazy `shap`, `ml.features`.
- **GOTCHA**: import `shap` lazily (cold ~1s). If shap import fails (Task 1 wheel risk), fall back to `bundle["model"].feature_importances_` for global importance.
- **VALIDATE**: covered by Task 7 integration.

### Task 7: Wire inference into `risk.py` (rules fallback preserved)
- **ACTION**: Replace formula body with model inference; keep `_risk`, clamp, persist loop, rules as fallback.
- **IMPLEMENT**:
  ```python
  import structlog
  log = structlog.get_logger()
  from ml.registry import load_model, ModelUnavailable
  from ml.features import extract_features, to_vector, FEATURE_ORDER
  from ml.explain import explain

  def predict_risks(db, account_id, *, persist=True):
      usage=...; payments=...; tickets=...; feedback=...; sub=...   # same queries as today
      feats = extract_features(usage, payments, tickets, feedback, sub, now=datetime.now(timezone.utc))
      preds = []
      for t in RISK_TYPES:
          try:
              b = load_model(t)
              prob = float(b["model"].predict_proba([to_vector(feats)])[0,1])
              conf = calibration_confidence(prob)          # e.g. distance from 0.5, or entropy-based
              preds.append(_risk(t, prob, conf, explain(b, feats), version=b["version"]))
          except ModelUnavailable:
              log.info("risk.model_unavailable.fallback", risk_type=t, account_id=account_id)
              preds.append(_rules_fallback(t, feats))       # today's formula, version=f"{t}-rules-fallback"
      for p in preds: p.account_id = account_id
      if persist: ...                                       # unchanged insert loop
      return preds
  ```
- **MIRROR**: RISK_RETURN_CONTRACT — extend `_risk` with an optional `version="1.0"` param; keep the persist loop byte-for-byte.
- **IMPORTS**: as shown; keep existing `datetime`, `Client`, `RiskPrediction`.
- **GOTCHA**: Preserve the exact Supabase queries (ordering, `.eq`, `desc=True`) — feature parity with today. Fallback must fire silently (no user-facing 500). Keep `_rules_fallback` = today's formulas so the demo still works with zero trained artifacts checked in.
- **VALIDATE**: `RUN_INTEGRATION_TESTS=1 pytest tests/test_risks.py` (after seeding) — thresholds still met by the model on demo accounts, or fallback covers them.

### Task 8: Update tests
- **ACTION**: Adjust `model_version` assertion; add ML unit tests.
- **IMPLEMENT**:
  - `test_risks.py:6` — change `== "1.0"` to `assert canc["model_version"].startswith("cancellation-")`.
  - `ml/tests/test_synth.py` — determinism (same seed → same labels) + non-degenerate positive rates.
  - `ml/tests/test_train_eval.py` — after training (or on a fixture artifact), each model's held-out PR-AUC exceeds the positive base rate; artifact round-trips through joblib with matching `FEATURE_ORDER`.
- **MIRROR**: TEST_STRUCTURE — hermetic tests take no `db`/`client` fixture, so they run in the normal (non-integration) suite.
- **IMPORTS**: `pytest`, `ml.*`.
- **GOTCHA**: ML tests must not require Supabase and must not require a 30-minute train — train a tiny `make_population(500)` inline, or ship a small committed fixture artifact. Keep `--cov-fail-under=65` green (add `ml/` to coverage or exclude it explicitly).
- **VALIDATE**: `cd services/api && pytest` (hermetic suite green) + `pytest ml/tests`.

### Task 9: Makefile target + docs
- **ACTION**: Make training one command; note artifact/versioning.
- **IMPLEMENT**: Add to `Makefile`:
  ```make
  train-ml: ## Train risk models (LR + XGBoost) into ml/models/
  	cd services/api && .venv/bin/python ../../ml/train.py
  ```
  Add a short `ml/README.md` documenting: synthetic-only, no causal claims, `model_version` scheme, retrain = restart.
- **MIRROR**: existing Makefile target + `##` help-comment style.
- **GOTCHA**: `ml/train.py` imports `seed_demo` builders via `sys.path` — run from repo root so relative paths resolve.
- **VALIDATE**: `make train-ml` produces artifacts; `make test-be` stays green.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `extract_features` order | raw event lists | dict with all `FEATURE_ORDER` keys, all floats | no |
| `extract_features` empty | empty lists | defaults (avg_feedback=5.0, counts=0), no crash | yes |
| synth determinism | `make_population(seed=42)` twice | identical labels | no |
| synth balance | `make_population(2000)` | each risk type positive rate ∈ (0.05, 0.6) | yes |
| train PR-AUC | trained model, held-out | PR-AUC > positive base rate | no |
| artifact round-trip | joblib dump→load | `features == FEATURE_ORDER`, model predicts | yes |
| explain shape | bundle + feats | ≤k dicts with feature/value/contribution | no |
| rules fallback | no artifact present | `predict_risks` returns 5 preds, version `*-rules-fallback` | yes |
| demo thresholds | seeded northstar/ember/atlas | cancellation≥0.75 / payment≥0.70 / expansion≥0.70 | yes |

### Edge Cases Checklist
- [ ] Account with zero events (all feature defaults) → no crash, low-confidence
- [ ] Missing model artifact → silent rules fallback, logged
- [ ] shap import failure → feature_importances_ fallback
- [ ] Degenerate label (all-0 for a risk type) → training guards / skips with warning
- [ ] Feature-order drift between artifact and code → explicit assertion error, not silent bad prediction

---

## Validation Commands

### Static Analysis
```bash
cd services/api && ruff check app ../../ml
```
EXPECT: Zero lint errors

### Dependencies install
```bash
cd services/api && uv pip install -e ".[dev]" && python -c "import sklearn, xgboost, shap, joblib"
```
EXPECT: Imports succeed

### Train
```bash
make train-ml && ls ml/models/*.joblib && cat ml/models/metrics.json
```
EXPECT: 5 artifacts + metrics with PR-AUC per type above base rate

### Hermetic unit suite
```bash
cd services/api && python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=65
```
EXPECT: All pass, coverage ≥65%

### ML tests
```bash
python -m pytest ml/tests
```
EXPECT: All pass

### Live integration (demo thresholds)
```bash
cd services/api && RUN_INTEGRATION_TESTS=1 python -m pytest tests/test_risks.py
```
EXPECT: Demo-account thresholds still satisfied

### Manual Validation
- [ ] `make run`, then `curl -s localhost:8000/api/v1/accounts/northstar/risks | jq` — cancellation ≥0.75, `model_version` non-`1.0`, `top_features_json` ranked
- [ ] Delete `ml/models/*.joblib`, re-curl — still returns 5 risks (fallback), version `*-rules-fallback`
- [ ] Frontend account page renders risks unchanged

---

## Acceptance Criteria
- [ ] LR + XGBoost trained per risk type on synthetic population; winner selected by PR-AUC
- [ ] Probabilities calibrated; metrics.json persisted
- [ ] SHAP (XGBoost) / coefficient (LR) explanations populate `top_features_json`
- [ ] `risk.py` inference wired with silent rules fallback
- [ ] Demo-account thresholds still met
- [ ] Hermetic suite + ML tests green, coverage ≥65%
- [ ] No lint/type errors

## Completion Checklist
- [ ] Code follows discovered patterns (extractor mirrors causes, contract mirrors risk.py)
- [ ] Fallback error handling silent + logged (structlog)
- [ ] Tests hermetic (no Supabase dependency for ML)
- [ ] No hardcoded probabilities remaining in the model path
- [ ] `model_version` truthful
- [ ] Synthetic-only limitation documented (ml/README.md)
- [ ] No scope creep (no new endpoints, no MLOps)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Circular labels** (model re-learns risk.py) | Medium | High | Labels from latent drivers via richer+noisier function; verify features are noisy projection (Task 3 gotcha) |
| Trained model misses demo thresholds | Medium | High | Tune synthetic driver→label mapping so seed accounts' feature profiles clear thresholds; else fallback covers demo |
| shap has no cp313 wheel | Medium | Medium | Lazy import + `feature_importances_` fallback; or pin compatible shap |
| Calibration optimistic | Low | Medium | Separate calibration split, `cv="prefit"` |
| XGBoost overfits small data | Low (synth is large) | Medium | 3–5k population, early stopping, PR-AUC selection vs LR |
| Coverage gate drops below 65% | Medium | Low | Add `ml/` to coverage or exclude; add ML unit tests |
| Artifact/feature-order drift | Low | High | Store FEATURE_ORDER in artifact + assert on load |

## Notes
- **Anti-circularity is the single most important design constraint.** The plan's
  credibility (and the judge answer to "did you train or simulate?") rests on labels
  coming from latent drivers through a function the model cannot trivially invert.
- The 50 seed accounts are **inference/demo only** — never training data.
- Rules fallback is permanent infrastructure (blueprint §12.2 503 path), not scaffolding.
- LR = cold-start / small-tenant path; XGBoost = high-volume path. Same pipeline scales
  to a real warehouse unchanged — this is the production story for the demo.
- Blueprint honesty requirements (§1.2, §19, Appendix D): keep "synthetic", "no causal
  claims", model version + timestamp visible.
