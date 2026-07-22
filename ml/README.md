# ValueLoop risk models (`ml/`)

Trained ML for the five subscription risks (cancellation, downgrade, inactivity,
payment failure, expansion readiness). Replaces the hand-tuned formulas that used
to live in `services/api/app/modules/risk.py`; those formulas remain as the
**deterministic fallback** when a model artifact is missing (blueprint §12.2).

## Pipeline

```
synth.py     3–5k-account synthetic population; labels sampled from latent
             drivers via a richer+noisier logistic than the old rules
   │         (anti-circularity — the model learns from a NOISY view, not the
   ▼         label generator inverted)
features.py  point-in-time feature extraction, shared by training and inference
   │
   ▼
train.py     per risk type: fit LR + XGBoost, calibrate (Platt), pick the higher
             held-out PR-AUC, dump ml/models/risk_<type>_v1.joblib + metrics.json
   │
   ▼
registry.py  cached loader (raises ModelUnavailable → rules fallback)
explain.py   ranked feature attribution (XGBoost native SHAP / LR coefficients)
```

## Train

```bash
make train-ml          # or: services/api/.venv/bin/python -m ml.train
```

Deterministic (seed 42). Writes 5 artifacts + `models/metrics.json`.

## Honesty / limitations

- **Synthetic data only.** No verified real churn labels exist. Numbers demonstrate
  the mechanism, not production accuracy or causal uplift (blueprint §1.2, §19,
  Appendix D). Do not present as validated on real customers.
- **The 50-account demo seed is never training data** — it is inference/demo only.
  The trained model scores demo accounts on its own merits (it does not reproduce
  the old rules-era thresholds); tests assert it ranks each account's risks
  correctly rather than hitting fixed cutoffs.
- **No temporal backtest** — snapshot data uses a stratified split; temporal
  validation is future work with real history.
- **LR wins most risk types** at this scale; XGBoost leads where interactions
  dominate. Same pipeline scales to a real warehouse (XGBoost for high-volume
  tenants, LR for cold-start).

## Model versioning

- Winner tagged `"<risk_type>-<algo>-v1"` (e.g. `cancellation-xgb-v1`), surfaced in
  the `model_version` field. Fallback path tags `"<risk_type>-rules-fallback"`.
- Artifacts store `FEATURE_ORDER`; `registry.load_model` refuses a bundle whose
  order drifts from `features.py` (retrain required).
- Loaded once per process (`@lru_cache`) — **retraining requires a restart.**
