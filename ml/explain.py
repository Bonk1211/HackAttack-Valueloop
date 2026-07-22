"""Per-prediction feature attribution → ranked top_features_json.

XGBoost path uses the booster's NATIVE SHAP values (predict(..., pred_contribs=
True)) — no `shap` package, which avoids the numba/llvmlite chain that has no
Python 3.13 wheel. LR path uses coefficient x standardized-value contributions.
Both return the same shape the frontend already renders (risk.py:67), extended
with a `contribution` field.
"""
import numpy as np
import xgboost as xgb

from ml.features import FEATURE_ORDER, to_vector


def _base_estimator(bundle: dict):
    """Unwrap the CalibratedClassifierCV to the fitted base estimator."""
    return bundle["model"].calibrated_classifiers_[0].estimator


def _contributions(bundle: dict, vec: list[float]) -> np.ndarray:
    x = np.array([vec], dtype=float)
    base = _base_estimator(bundle)
    if bundle["algo"] == "xgboost":
        contribs = base.get_booster().predict(xgb.DMatrix(x), pred_contribs=True)[0]
        return contribs[:-1]  # drop bias term
    # lr: pipeline(StandardScaler, LogisticRegression)
    scaler = base.named_steps["standardscaler"]
    lr = base.named_steps["logisticregression"]
    return lr.coef_[0] * scaler.transform(x)[0]


def explain(bundle: dict, feats: dict, k: int = 3) -> list[dict]:
    """Top-k features by absolute contribution to this prediction."""
    contribs = _contributions(bundle, to_vector(feats))
    order = np.argsort(np.abs(contribs))[::-1][:k]
    return [
        {
            "feature": FEATURE_ORDER[i],
            "value": round(float(feats[FEATURE_ORDER[i]]), 3),
            "contribution": round(float(contribs[i]), 3),
        }
        for i in order
    ]
