from datetime import date

import pytest

from avermont_worker import analytics
from avermont_worker.sources import ecb
from avermont_worker.validate import validate_points


def test_validation_drops_invalid_and_duplicates_but_flags_jumps():
    pts = [("2024-01-01", 10), ("2024-02-01", -1), ("2024-02-01", 11), ("2024-03-01", "x"), ("2024-04-01", 30), ("2024-01-01", 12)]
    clean, rep = validate_points(pts)
    assert [d for d, _ in clean] == ["2024-01-01", "2024-02-01", "2024-04-01"]
    assert rep.dropped == 3
    assert any("variação extrema" in w for w in rep.warnings)


def test_summary_monthly_changes():
    pts = [[f"2024-{m:02d}-01", 100 + m] for m in range(1, 13)] + [["2025-01-01", 120.0]]
    s = analytics.summarize(pts, "monthly", today=date(2025, 2, 10))
    assert s["changes"]["m1"] == pytest.approx(120 / 112 - 1)
    assert s["changes"]["y1"] == pytest.approx(120 / 101 - 1)
    assert s["changes"]["d1"] is None  # série mensal não tem variação diária
    assert s["stale"] is False


def test_summary_flags_stale_daily_series():
    pts = [["2025-01-01", 1.0], ["2025-01-02", 1.1]]
    s = analytics.summarize(pts, "daily", today=date(2025, 2, 1))
    assert s["stale"] is True


def test_dxy_replica_formula_constant():
    rates = {c: {"2025-01-02": 1.0} for c in ecb.CURRENCIES}
    (d, v), = ecb.dxy_replica(rates)
    assert v == pytest.approx(50.14348112)


def test_cross_rate():
    rates = {"BRL": {"d": 6.0}, "CNY": {"d": 7.5}}
    assert ecb.cross(rates, "CNY", "BRL")[0][1] == pytest.approx(0.8)


def test_correlation_identical_series():
    pts = [[f"{2010 + i // 12}-{i % 12 + 1:02d}-01", 100 * (1.01 ** i) * (1.05 if i % 3 == 0 else 1)] for i in range(80)]
    out = analytics.correlations({"a": pts, "b": pts}, window=120)
    assert out["pairs"]["a|b"]["r"] == pytest.approx(1.0, abs=1e-6)


def test_demo_series_is_deterministic_and_base_100():
    a = analytics.demo_series("pet")
    b = analytics.demo_series("pet")
    assert a == b
    assert a[0][1] == pytest.approx(100.0)
