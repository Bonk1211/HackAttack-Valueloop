from ml.synth import RISK_TYPES, make_population


def test_synth_is_deterministic():
    X1, y1 = make_population(300, seed=42)
    X2, y2 = make_population(300, seed=42)
    assert y1 == y2
    assert X1 == X2


def test_synth_labels_non_degenerate():
    """Every risk type must have a usable, non-degenerate positive rate — else a
    classifier has nothing to learn (or trivially predicts one class)."""
    _, y = make_population(2000, seed=42)
    for t in RISK_TYPES:
        rate = sum(y[t]) / len(y[t])
        assert 0.05 < rate < 0.6, f"{t} positive rate {rate:.3f} out of band"
