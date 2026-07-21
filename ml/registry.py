"""Cached model loader. Mirrors the @lru_cache singleton pattern used by
app.config.get_settings and app.core.db.get_supabase — artifacts load once per
process, so retraining requires a process restart (documented in ml/README.md).
"""
from functools import lru_cache
from pathlib import Path

import joblib

from ml.features import FEATURE_ORDER

MODELS_DIR = Path(__file__).resolve().parent / "models"


class ModelUnavailable(Exception):
    """Raised when a risk-type artifact is missing or stale. Callers catch this
    and fall back to deterministic rules (blueprint §12.2 503 path)."""


@lru_cache(maxsize=None)
def load_model(risk_type: str) -> dict:
    """Return the artifact bundle {model, algo, features, version} for a risk type."""
    path = MODELS_DIR / f"risk_{risk_type}_v1.joblib"
    if not path.exists():
        raise ModelUnavailable(f"no artifact for '{risk_type}' at {path}")
    bundle = joblib.load(path)
    # Guard against silent feature drift between the trained artifact and the
    # current extractor — a mismatch means predictions would be meaningless.
    if bundle.get("features") != FEATURE_ORDER:
        raise ModelUnavailable(f"feature-order mismatch for '{risk_type}' (retrain required)")
    return bundle
