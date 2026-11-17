from datetime import date

import numpy as np
import pandas as pd
import pytest

from avermont_worker import forecast
from avermont_worker.forecast import INSUFFICIENT_MSG, SeriesInput, forecast_series


def monthly_dates(n, start="2000-01-01"):
    return [d.date().isoformat() for d in pd.date_range(start, periods=n, freq="MS")]


def make(values, freq="monthly", start="2000-01-01", sid="t"):
    dates = monthly_dates(len(values), start) if freq == "monthly" else [d.date().isoformat() for d in pd.bdate_range(start, periods=len(values))]
    return SeriesInput(sid, freq, dates, list(values))


def test_insufficient_data_uses_exact_message():
    res = forecast_series(make(100 + np.arange(30.0)))
    assert all(h["status"] == "insufficient_data" for h in res["horizons"].values())
    assert all(h["message"] == "Dados insuficientes para uma previsão confiável." for h in res["horizons"].values())


def test_monthly_series_has_no_7d_forecast():
    rng = np.random.default_rng(1)
    vals = 100 * np.exp(np.cumsum(rng.normal(0, 0.04, 240)))
    last = monthly_dates(240)[-1]
    res = forecast_series(make(vals), today=date.fromisoformat(last))
    assert res["horizons"]["7d"]["status"] == "frequency_mismatch"
    assert res["horizons"]["7d"]["message"] == INSUFFICIENT_MSG


def test_random_walk_does_not_claim_skill_and_intervals_are_calibrated():
    rng = np.random.default_rng(42)
    vals = 100 * np.exp(np.cumsum(rng.normal(0, 0.05, 260)))
    res = forecast_series(make(vals), today=date.fromisoformat(monthly_dates(260)[-1]))
    h = res["horizons"]["30d"]
    assert h["status"] == "ok"
    # Em passeio aleatório puro o motor não pode alegar habilidade: o teste de Diebold-Mariano barra ganhos espúrios.
    for label in ("30d", "90d", "180d"):
        hh = res["horizons"][label]
        assert hh["beatsBaseline"] is False or hh["dieboldMarianoP"] < 0.05
    cov = h["evaluation"]["intervalCoverage"]
    assert 0.5 <= cov <= 1.0
    assert h["low"] < h["central"] < h["high"]


def test_trending_series_beats_naive():
    rng = np.random.default_rng(7)
    t = np.arange(260)
    vals = 50 * np.exp(0.02 * t + rng.normal(0, 0.005, 260))
    res = forecast_series(make(vals), today=date.fromisoformat(monthly_dates(260)[-1]))
    h = res["horizons"]["90d"]
    assert h["status"] == "ok"
    assert h["beatsBaseline"] is True
    assert h["direction"] == "up"


def test_expired_when_source_is_stale():
    rng = np.random.default_rng(3)
    vals = 100 * np.exp(np.cumsum(rng.normal(0, 0.03, 200)))
    res = forecast_series(make(vals), today=date(2099, 1, 1))
    assert res["horizons"]["30d"]["status"] == "expired"


def test_12m_requires_long_history():
    rng = np.random.default_rng(5)
    vals = 100 * np.exp(np.cumsum(rng.normal(0, 0.03, 150)))  # 12,5 anos
    res = forecast_series(make(vals), today=date.fromisoformat(monthly_dates(150)[-1]))
    assert res["horizons"]["12m"]["status"] in ("not_justified", "insufficient_data")
    assert res["horizons"]["12m"]["message"] == INSUFFICIENT_MSG


def test_models_do_not_peek_into_the_future():
    """Mudar dados POSTERIORES à origem não pode alterar a previsão feita na origem."""
    rng = np.random.default_rng(11)
    y = np.log(100 * np.exp(np.cumsum(rng.normal(0, 0.04, 200))))
    ctx = forecast.Ctx(frequency="monthly", months=np.array([(i % 12) + 1 for i in range(200)]), window=240)
    origin = 150
    a = forecast.run_all(y[: origin + 1], [1, 3], ctx)
    y2 = y.copy()
    y2[origin + 1 :] += 5.0  # choque gigantesco no futuro
    b = forecast.run_all(y2[: origin + 1], [1, 3], ctx)
    for model in a:
        for h in a[model]:
            assert a[model][h] == pytest.approx(b[model][h])


def test_monthly_target_month_still_running_is_not_expired():
    rng = np.random.default_rng(9)
    vals = 100 * np.exp(np.cumsum(rng.normal(0, 0.03, 200)))
    dates = monthly_dates(200)
    last = date.fromisoformat(dates[-1])
    # 17 dias após o início do mês seguinte: a média desse mês ainda está em formação
    today = date(last.year + (last.month // 12), last.month % 12 + 1, 17)
    res = forecast_series(make(vals), today=today)
    assert res["horizons"]["30d"]["status"] in ("ok", "not_justified")
