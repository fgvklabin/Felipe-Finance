"""Estatísticas descritivas, correlações e séries de demonstração."""
from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

STALE_DAYS = {"daily": 5, "monthly": 75}


def _pct(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return a / b - 1


def summarize(points: list[list], frequency: str, today: date | None = None) -> dict:
    """Variações, volatilidade, faixa de 52 semanas, sparkline e status de atualização."""
    today = today or date.today()
    if not points:
        return {"status": "no_data"}
    s = pd.Series([p[1] for p in points], index=pd.to_datetime([p[0] for p in points]))
    last_d, last = s.index[-1], float(s.iloc[-1])

    def at_or_before(d):
        sub = s[s.index <= d]
        return float(sub.iloc[-1]) if len(sub) else None

    if frequency == "daily":
        prev = float(s.iloc[-2]) if len(s) > 1 else None
        ch = {
            "d1": _pct(last, prev),
            "w1": _pct(last, at_or_before(last_d - timedelta(days=7))),
            "m1": _pct(last, at_or_before(last_d - timedelta(days=30))),
            "m3": _pct(last, at_or_before(last_d - timedelta(days=91))),
            "y1": _pct(last, at_or_before(last_d - timedelta(days=365))),
        }
        lr = np.diff(np.log(s.values[-64:]))
        vol = float(np.std(lr, ddof=1) * math.sqrt(252)) if len(lr) > 10 else None
        spark = s[s.index >= last_d - timedelta(days=120)]
    else:
        ch = {
            "d1": None, "w1": None,
            "m1": _pct(last, float(s.iloc[-2])) if len(s) > 1 else None,
            "m3": _pct(last, float(s.iloc[-4])) if len(s) > 3 else None,
            "y1": _pct(last, float(s.iloc[-13])) if len(s) > 12 else None,
        }
        lr = np.diff(np.log(s.values[-25:]))
        vol = float(np.std(lr, ddof=1) * math.sqrt(12)) if len(lr) > 6 else None
        spark = s.iloc[-36:]
    prev_year = s[s.index < pd.Timestamp(year=last_d.year, month=1, day=1)]
    ch["ytd"] = _pct(last, float(prev_year.iloc[-1])) if len(prev_year) else None
    year_window = s[s.index >= last_d - timedelta(days=365)]
    age_days = (today - last_d.date()).days
    if frequency == "monthly":
        age_days = (today - (last_d + pd.offsets.MonthEnd(0)).date()).days
    return {
        "last": last,
        "lastDate": last_d.date().isoformat(),
        "changes": ch,
        "volatility": vol,
        "high52w": float(year_window.max()),
        "low52w": float(year_window.min()),
        "spark": [round(float(v), 6) for v in spark.values],
        "firstDate": s.index[0].date().isoformat(),
        "observations": int(len(s)),
        "ageDays": age_days,
        "stale": age_days > STALE_DAYS[frequency],
    }


def monthly_average(points: list[list]) -> list[list]:
    s = pd.Series([p[1] for p in points], index=pd.to_datetime([p[0] for p in points]))
    m = s.resample("MS").mean().dropna()
    # descarta o mês corrente incompleto
    if len(m) and m.index[-1].to_period("M") == pd.Timestamp(date.today()).to_period("M"):
        m = m.iloc[:-1]
    return [[d.date().isoformat(), float(v)] for d, v in m.items()]


def correlations(monthly: dict[str, list[list]], window: int = 120) -> dict:
    """Correlação de Pearson de retornos logarítmicos mensais, com IC 95% (Fisher z) e estabilidade."""
    frames = {k: pd.Series([p[1] for p in v], index=pd.to_datetime([p[0] for p in v])) for k, v in monthly.items() if len(v) > 36}
    df = pd.DataFrame(frames).sort_index()
    rets = np.log(df).diff()
    end = rets.dropna(how="all").index.max()
    rets = rets[rets.index > end - pd.DateOffset(months=window)]
    ids = list(rets.columns)
    out = {"window": window, "end": end.date().isoformat(), "ids": ids, "pairs": {}}
    for i, a in enumerate(ids):
        for b in ids[i + 1 :]:
            pair = rets[[a, b]].dropna()
            n = len(pair)
            if n < 24:
                continue
            r = float(pair[a].corr(pair[b]))
            if not math.isfinite(r):
                continue
            z = math.atanh(max(min(r, 0.9999), -0.9999))
            se = 1 / math.sqrt(n - 3)
            lo, hi = math.tanh(z - 1.96 * se), math.tanh(z + 1.96 * se)
            roll = pair[a].rolling(36).corr(pair[b]).dropna()
            out["pairs"][f"{a}|{b}"] = {
                "r": round(r, 4), "n": n, "ci": [round(lo, 4), round(hi, 4)],
                "rollingMin": round(float(roll.min()), 3) if len(roll) else None,
                "rollingMax": round(float(roll.max()), 3) if len(roll) else None,
                "rollingStd": round(float(roll.std()), 3) if len(roll) > 2 else None,
            }
    return out


def demo_series(series_id: str, years: int = 10) -> list[list]:
    """Índice DEMONSTRATIVO base 100 (passeio aleatório geométrico determinístico). NÃO é dado de mercado."""
    seed = int(hashlib.sha256(series_id.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    today = date.today()
    start = date(today.year - years, today.month, 1)
    dates = pd.date_range(start, periods=years * 12, freq="MS")
    rets = rng.normal(0.002, 0.045, len(dates))
    rets += 0.02 * np.sin(np.arange(len(dates)) / 6)  # ciclo artificial, explicitamente demonstrativo
    vals = 100 * np.exp(np.cumsum(rets) - rets[0])
    return [[d.date().isoformat(), round(float(v), 4)] for d, v in zip(dates, vals)]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
