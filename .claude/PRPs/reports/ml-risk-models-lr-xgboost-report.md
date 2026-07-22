# Implementation Report: ML Risk Models — LR + XGBoost

## Summary
Replaced the hand-tuned deterministic formulas in `services/api/app/modules/risk.py`
with a trained-ML pipeline: a synthetic-population generator, a shared feature
extractor, per-risk-type training of Logistic Regression + XGBoost with Platt
calibration and PR-AUC model selection, a cached artifact registry, and native
feature attribution. Inference is wired into `predict_risks` with the original
deterministic formulas preserved as a silent rules fallback.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 7/10 | Held — the two flagged risks (shap wheel, demo thresholds) both materialized and were handled |
| Files Changed | ~12 (7 create, 5 update) | 15 tracked (11 create, 4 update) + 6 generated artifacts |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Add ML dependencies | Complete | Deviated — dropped `shap` (no py3.13 wheel), use XGBoost native SHAP |
| 2 | Shared feature extractor | Complete | Fixed naive/aware datetime bug for date-only renewal_date |
| 3 | Synthetic population generator | Complete | Tuned intercepts for realistic imbalanced rates (0.31–0.40) |
| 4 | Train + calibrate + select | Complete | LR wins 4/5, XGBoost wins cancellation; all beat base rate |
| 5 | Model registry / loader | Complete | lru_cache + feature-order guard |
| 6 | Explanation helper | Complete | XGBoost native pred_contribs / LR coefficients |
| 7 | Wire inference into risk.py | Complete | Added sys.path bootstrap for cross-dir `ml` import |
| 8 | Update tests | Complete | Deviated — honest ranking asserts, not rules-era thresholds (user decision) |
| 9 | Makefile target + docs | Complete | `make train-ml` + ml/README.md |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (ruff) | Pass | `app` + `ml` clean |
| Unit Tests (hermetic) | Pass | 50 passed, 63 skipped (integration), coverage 66.87% ≥ 65% |
| ML Tests | Pass | 4 passed (synth determinism/balance, PR-AUC beats base, artifact round-trip) |
| Build (app import) | Pass | `app.main` imports, 25 routes |
| Integration (live) | Blocked | `.env` Supabase key invalid (`Invalid API key` at seed step) — environment, not code |
| Integration (offline proxy) | Pass | Ran full extract→model path on committed seed CSVs; all 3 ranking asserts hold |
| Edge Cases | Pass | rules-fallback fires with truthful version; empty account no crash; confidence maps [0,1]→[.5,1] |

### Model metrics (held-out PR-AUC vs base rate)
| Risk type | LR | XGBoost | Winner | Base rate |
|---|---|---|---|---|
| cancellation | 0.639 | 0.641 | xgboost | 0.388 |
| downgrade | 0.501 | 0.470 | lr | 0.341 |
| inactivity | 0.482 | 0.440 | lr | 0.324 |
| payment_failure | 0.597 | 0.565 | lr | 0.375 |
| expansion_readiness | 0.492 | 0.475 | lr | 0.312 |

Every model beats its base rate — real (modest, honestly noisy) signal, not memorization.

## Files Changed

| File | Action |
|---|---|
| `ml/__init__.py` | CREATED |
| `ml/features.py` | CREATED |
| `ml/synth.py` | CREATED |
| `ml/train.py` | CREATED |
| `ml/registry.py` | CREATED |
| `ml/explain.py` | CREATED |
| `ml/README.md` | CREATED |
| `ml/models/.gitkeep` | CREATED |
| `ml/models/risk_*.joblib` (5) + `metrics.json` | GENERATED |
| `ml/tests/test_synth.py` | CREATED |
| `ml/tests/test_train_eval.py` | CREATED |
| `services/api/pyproject.toml` | UPDATED |
| `services/api/app/modules/risk.py` | UPDATED |
| `services/api/tests/test_risks.py` | UPDATED |
| `Makefile` | UPDATED |

## Deviations from Plan

1. **Dropped `shap` dependency (Task 1).** WHAT: removed `shap==0.46.0`; use
   `booster.predict(..., pred_contribs=True)` for XGBoost SHAP values, coefficients
   for LR. WHY: the full `.[dev]` solve pulled `numba 0.53.1`/`llvmlite 0.36.0`,
   which has no Python 3.13 wheel (`only versions >=3.6,<3.10`). XGBoost computes
   SHAP natively — no numba chain, lazier, same output.

2. **sys.path bootstrap in risk.py (Task 7).** WHAT: risk.py inserts the repo root
   on `sys.path` before importing `ml`. WHY: the backend runs with CWD=services/api
   but `ml/` lives at repo root; without this, `import ml` fails at server startup.

3. **Honest ranking tests instead of rules-era thresholds (Task 8).** WHAT: the 3
   demo tests now assert the model RANKS each account's risks correctly (northstar
   cancellation top-2, ember payment top-2, atlas expansion top-1) + truthful
   `model_version`, instead of the old absolute cutoffs (0.75/0.70/0.70). WHY: user
   decision — the model, trained on synthetic data, honestly scores demo accounts
   below the hand-tuned rule numbers; rather than tune synthetic data to hit demo
   targets, keep the model honest and test behavior that's true under both the model
   and the fallback.

## Issues Encountered

- **shap install failure** → resolved via native XGBoost SHAP (deviation 1).
- **naive/aware datetime subtraction** on date-only `renewal_date` → `_parse` now
  normalizes to tz-aware UTC.
- **synthetic positive rates too high** (cancellation 0.61) → lowered intercepts to
  realistic imbalanced rates (0.31–0.40).
- **model missed demo thresholds** on seed accounts (northstar cancellation 0.27 vs
  0.75) → surfaced to user; chosen resolution: honest ranking tests (deviation 3).
- **live integration blocked** by invalid `.env` Supabase key → validated the same
  code path offline against committed seed CSVs.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `ml/tests/test_synth.py` | 2 | determinism + label balance |
| `ml/tests/test_train_eval.py` | 2 | PR-AUC beats base rate + artifact round-trip |
| `services/api/tests/test_risks.py` | 5 (rewritten) | ranking behavior + clamp unit |

## Next Steps
- [ ] Re-run live integration once valid Supabase credentials are configured
- [ ] Decide whether to commit the `.joblib` artifacts or train in CI (`make train-ml`)
- [ ] Code review via `/code-review`
- [ ] Create PR via `/prp-pr`
