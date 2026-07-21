"""Synthetic training population for the risk models.

ANTI-CIRCULARITY (the single most important design constraint):
labels are sampled from *latent drivers* through a logistic function that is
structurally richer + noisier than app.modules.risk's formulas (interaction
terms, gaussian noise, and two red-herring drivers that never touch any label).
Events are then generated *from* those drivers, and features are extracted from
the events — so the feature vector the model sees is a NOISY projection of the
latent state, not the label generator inverted. A model that scores well here
has learned to recover the drivers from noisy signals, not memorized a rule.

The 50-account demo seed (scripts/seed_demo.py) is NEVER training data; this
generator is the only training source.
"""
import math
import random
import sys
from datetime import timedelta
from pathlib import Path

from ml.features import extract_features

# Reuse the demo seed's event builders so synthetic rows match the real schema
# and the same feature extractor works on both. NOW anchors every generated
# timestamp; we pass the same NOW to extract_features for consistency.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from seed_demo import (  # noqa: E402
    NOW,
    gen_usage_events,
    gen_payment_events,
    gen_support_tickets,
    gen_feedback_events,
)

RISK_TYPES = ["cancellation", "downgrade", "inactivity", "payment_failure", "expansion_readiness"]

_USER_IDS = ["u-synth-1", "u-synth-2", "u-synth-3"]


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _sample_drivers(rng: random.Random) -> dict:
    """Latent ground-truth state of an account. Continuous in [0, 1]."""
    return {
        "decline": rng.random(),        # usage falling off
        "ticket_load": rng.random(),    # support pressure
        "pay_trouble": rng.random(),    # billing failures
        "dissat": rng.random(),         # dissatisfaction
        "lowadopt": rng.random(),       # weak feature adoption
        "renewal_near": rng.random(),   # renewal proximity
        # red herrings — vary the events but never enter _label_probs
        "noise_a": rng.random(),
        "noise_b": rng.random(),
    }


def _label_probs(d: dict, rng: random.Random) -> dict:
    """Per-risk churn probability from latent drivers. Richer + noisier than
    risk.py: each has an interaction term and per-account gaussian noise."""
    n = lambda: rng.gauss(0.0, 0.5)  # noqa: E731
    return {
        "cancellation": _sigmoid(2.2 * d["ticket_load"] + 1.8 * d["decline"]
                                 + 1.3 * d["ticket_load"] * d["decline"]
                                 + 0.7 * d["renewal_near"] - 3.2 + n()),
        "downgrade": _sigmoid(1.9 * d["lowadopt"] + 1.6 * d["dissat"]
                              + 0.9 * d["lowadopt"] * d["decline"] - 2.8 + n()),
        "inactivity": _sigmoid(2.6 * d["decline"] + 1.2 * d["lowadopt"]
                               + 0.8 * d["decline"] * d["lowadopt"] - 3.0 + n()),
        "payment_failure": _sigmoid(3.0 * d["pay_trouble"] + 0.6 * d["renewal_near"]
                                    + 0.7 * d["pay_trouble"] * d["renewal_near"] - 2.6 + n()),
        "expansion_readiness": _sigmoid(2.2 * (1 - d["lowadopt"]) + 1.5 * (1 - d["dissat"])
                                        - 1.4 * d["ticket_load"] - 2.0 + n()),
    }


def _events_from_drivers(acc_id: str, d: dict, rng: random.Random):
    """Generate raw event lists from latent drivers. Deliberately noisy: counts
    and timestamps carry sampling randomness so extract_features yields a noisy
    view of the drivers, not a clean readout."""
    # Usage: fewer recent events as decline rises; adoption shifts feature mix.
    recent_count = max(1, int(round(28 * (1 - d["decline"]) + rng.gauss(0, 4))))
    older_count = max(1, int(round(24 + rng.gauss(0, 4))))
    core_w = max(0.1, 1.0 - d["lowadopt"])
    feature_weights = {
        "core_workflow": core_w * 4,
        "dashboard": 2,
        "reports": 2,
        "exports": 1 + d["noise_a"] * 3,   # red herring drives export share
        "settings": 1,
    }
    usage = gen_usage_events(acc_id, rng, _USER_IDS, recent_count, older_count, 30, 60, feature_weights)

    # Payments: 0-3 failures scaling with pay_trouble.
    n_fail = min(3, max(0, int(round(d["pay_trouble"] * 3 + rng.gauss(0, 0.4)))))
    pay_specs = [(rng.uniform(0, 28), "failed", "card_declined", i + 1, 500) for i in range(n_fail)]
    pay_specs += [(rng.uniform(0, 60), "succeeded", None, 1, 500) for _ in range(rng.randint(1, 3))]
    payments = gen_payment_events(acc_id, pay_specs)

    # Tickets: open critical/high scaling with ticket_load.
    n_crit = 1 if d["ticket_load"] > 0.7 and rng.random() < 0.8 else 0
    n_high = min(2, max(0, int(round(d["ticket_load"] * 2 + rng.gauss(0, 0.5)))))
    tick_specs = [(rng.uniform(0, 20), None, "critical", "bug", "negative") for _ in range(n_crit)]
    tick_specs += [(rng.uniform(0, 20), None, "high", "bug", "negative") for _ in range(n_high)]
    tick_specs += [(rng.uniform(20, 60), 3, "medium", "howto", "neutral") for _ in range(rng.randint(0, 2))]
    tickets = gen_support_tickets(acc_id, tick_specs)

    # Feedback: score falls with dissatisfaction.
    base = 9.0 - 6.0 * d["dissat"]
    fb_specs = [(rng.uniform(0, 45), "csat", max(0.0, min(10.0, base + rng.gauss(0, 1.0))), None)
                for _ in range(rng.randint(1, 3))]
    feedback = gen_feedback_events(acc_id, fb_specs)

    # Renewal proximity: nearer renewal = fewer days out.
    days_out = int(round(365 * (1 - d["renewal_near"]))) + 15
    subscription = {"renewal_date": (NOW + timedelta(days=days_out)).date().isoformat(), "status": "active"}

    return usage, payments, tickets, feedback, subscription


def make_population(n: int = 4000, seed: int = 42):
    """Return (X, y): X = list of feature dicts, y = {risk_type: [0/1, ...]}."""
    rng = random.Random(seed)
    X: list[dict] = []
    y: dict[str, list[int]] = {t: [] for t in RISK_TYPES}
    for i in range(n):
        d = _sample_drivers(rng)
        events = _events_from_drivers(f"synth-{i:05d}", d, rng)
        feats = extract_features(*events, now=NOW)
        probs = _label_probs(d, rng)
        X.append(feats)
        for t in RISK_TYPES:
            y[t].append(int(rng.random() < probs[t]))
    return X, y
