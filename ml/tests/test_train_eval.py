import io

import joblib
import numpy as np
from sklearn.metrics import average_precision_score
from sklearn.model_selection import train_test_split

from ml.features import FEATURE_ORDER
from ml.synth import make_population
from ml.train import _matrix, _train_one


def _split(X, yt):
    Xtmp, Xte, ytmp, yte = train_test_split(X, yt, test_size=0.2, stratify=yt, random_state=42)
    Xtr, Xcal, ytr, ycal = train_test_split(Xtmp, ytmp, test_size=0.2, stratify=ytmp, random_state=42)
    return Xtr, Xcal, Xte, ytr, ycal, yte


def test_trained_model_beats_base_rate():
    """A trained model must carry real signal: held-out PR-AUC above the
    positive base rate (what a no-skill constant predictor achieves)."""
    X, y = make_population(1500, seed=42)
    M = _matrix(X)
    yt = np.array(y["cancellation"])
    Xtr, Xcal, Xte, ytr, ycal, yte = _split(M, yt)
    model = _train_one(Xtr, ytr, Xcal, ycal, "lr")
    pr_auc = average_precision_score(yte, model.predict_proba(Xte)[:, 1])
    assert pr_auc > yte.mean(), f"PR-AUC {pr_auc:.3f} not above base rate {yte.mean():.3f}"


def test_artifact_roundtrips_with_feature_order():
    """The persisted bundle must carry FEATURE_ORDER and predict after a
    joblib round-trip — the guard registry.load_model relies on."""
    X, y = make_population(800, seed=42)
    M = _matrix(X)
    yt = np.array(y["payment_failure"])
    Xtr, Xcal, Xte, ytr, ycal, yte = _split(M, yt)
    model = _train_one(Xtr, ytr, Xcal, ycal, "lr")
    bundle = {"model": model, "algo": "lr", "features": FEATURE_ORDER, "version": "payment_failure-lr-v1"}

    buf = io.BytesIO()
    joblib.dump(bundle, buf)
    buf.seek(0)
    loaded = joblib.load(buf)

    assert loaded["features"] == FEATURE_ORDER
    proba = loaded["model"].predict_proba(Xte[:1])[:, 1]
    assert 0.0 <= float(proba[0]) <= 1.0
