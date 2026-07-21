"""Train LR + XGBoost per risk type on the synthetic population, calibrate,
select the higher held-out PR-AUC, and persist artifacts to ml/models/.

Run from repo root:
    services/api/.venv/bin/python ml/train.py
or:
    make train-ml

Deterministic (seed 42, matching seed_demo.SEED). Synthetic-data only — see
ml/README.md for the honesty/limitations note.
"""
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from ml.features import FEATURE_ORDER, to_vector
from ml.synth import RISK_TYPES, make_population

MODELS_DIR = Path(__file__).resolve().parent / "models"
SEED = 42
POP_SIZE = 4000


def _matrix(X: list[dict]) -> np.ndarray:
    return np.array([to_vector(f) for f in X], dtype=float)


def _train_one(Xtr, ytr, Xcal, ycal, algo: str):
    """Fit a base estimator then calibrate it on a held-out slice (cv='prefit')."""
    if algo == "lr":
        base = make_pipeline(StandardScaler(),
                             LogisticRegression(class_weight="balanced", max_iter=1000, random_state=SEED))
        base.fit(Xtr, ytr)
    else:  # xgboost
        pos = int(np.sum(ytr))
        neg = len(ytr) - pos
        spw = (neg / pos) if pos else 1.0
        # carve an eval slice from train for early stopping (not the calib/test sets)
        Xf, Xe, yf, ye = train_test_split(Xtr, ytr, test_size=0.2, stratify=ytr, random_state=SEED)
        base = XGBClassifier(max_depth=5, n_estimators=400, learning_rate=0.05,
                             subsample=0.9, colsample_bytree=0.9, scale_pos_weight=spw,
                             eval_metric="aucpr", early_stopping_rounds=25, random_state=SEED)
        base.fit(Xf, yf, eval_set=[(Xe, ye)], verbose=False)
    calibrated = CalibratedClassifierCV(base, method="sigmoid", cv="prefit")
    calibrated.fit(Xcal, ycal)
    return calibrated


def main():
    print(f"Generating synthetic population (n={POP_SIZE}, seed={SEED})...")
    X, y = make_population(POP_SIZE, seed=SEED)
    M = _matrix(X)
    metrics = {}

    for t in RISK_TYPES:
        yt = np.array(y[t])
        # train(64%) / calib(16%) / test(20%)
        Xtmp, Xte, ytmp, yte = train_test_split(M, yt, test_size=0.2, stratify=yt, random_state=SEED)
        Xtr, Xcal, ytr, ycal = train_test_split(Xtmp, ytmp, test_size=0.2, stratify=ytmp, random_state=SEED)

        results = {}
        for algo in ("lr", "xgboost"):
            model = _train_one(Xtr, ytr, Xcal, ycal, algo)
            proba = model.predict_proba(Xte)[:, 1]
            results[algo] = (model, average_precision_score(yte, proba))

        winner_algo = max(results, key=lambda a: results[a][1])
        winner_model = results[winner_algo][0]
        base_rate = float(yte.mean())
        version = f"{t}-{'xgb' if winner_algo == 'xgboost' else 'lr'}-v1"

        joblib.dump(
            {"model": winner_model, "algo": winner_algo, "features": FEATURE_ORDER, "version": version},
            MODELS_DIR / f"risk_{t}_v1.joblib",
        )
        metrics[t] = {
            "lr_pr_auc": round(float(results["lr"][1]), 4),
            "xgb_pr_auc": round(float(results["xgboost"][1]), 4),
            "winner": winner_algo,
            "version": version,
            "base_rate": round(base_rate, 4),
        }
        print(f"{t:22s} lr={metrics[t]['lr_pr_auc']:.3f} xgb={metrics[t]['xgb_pr_auc']:.3f} "
              f"base={base_rate:.3f} -> {version}")

    (MODELS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"Wrote {len(RISK_TYPES)} models + metrics.json to {MODELS_DIR}")


if __name__ == "__main__":
    main()
