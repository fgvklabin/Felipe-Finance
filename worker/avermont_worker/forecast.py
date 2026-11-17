"""Avermont Forecast Engine — previsões estatísticas com validação walk-forward.

Princípios (ver docs/FORECAST_ENGINE.md):
  * Toda previsão é numérica e vem de modelos estatísticos/ML; nenhum LLM gera números.
  * Validação walk-forward com origens cronológicas: em cada origem o modelo só vê dados até ela
    (sem vazamento). As origens são divididas em JANELA DE SELEÇÃO (escolhe o modelo e calibra o
    intervalo) e JANELA DE AVALIAÇÃO (métricas reportadas, fora da amostra da seleção).
  * Baseline obrigatória: passeio aleatório (naive). Se o modelo escolhido não superar o naive na
    janela de avaliação, publicamos o naive e dizemos isso.
  * Intervalos de previsão = quantis empíricos (10%, 90%) dos erros walk-forward → intervalo de 80%.
    A cobertura observada fora da amostra é reportada.
  * Horizonte de 12 meses só é publicado com histórico ≥ 15 anos e cobertura de intervalo aceitável.
  * Frequência incompatível, dados insuficientes ou fonte desatualizada → status explícito, nunca número.
"""
from __future__ import annotations

import logging
import math
import warnings
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable

import numpy as np
from sklearn.linear_model import Ridge

log = logging.getLogger("avermont.forecast")

INSUFFICIENT_MSG = "Dados insuficientes para uma previsão confiável."

HORIZONS = {
    # label: (passos mensais, passos diários úteis, dias corridos aproximados)
    "7d": (None, 5, 7),
    "30d": (1, 21, 30),
    "90d": (3, 63, 91),
    "180d": (6, 126, 182),
    "12m": (12, 252, 365),
}


@dataclass
class Ctx:
    frequency: str  # "monthly" | "daily"
    months: np.ndarray | None  # mês do calendário (1..12) de cada observação, para sazonalidade
    window: int


# ----------------------------------------------------------------------------- modelos
# Cada modelo recebe y (log-preços até a origem, inclusive) e uma lista de horizontes; devolve
# {h: previsão do log-preço em t+h}. Ajuste único por origem, previsão de todos os horizontes.

def m_naive(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[int, float]:
    return {h: float(y[-1]) for h in hs}


def m_drift(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[int, float]:
    w = min(len(y) - 1, ctx.window)
    slope = (y[-1] - y[-1 - w]) / w
    return {h: float(y[-1] + slope * h) for h in hs}


def m_seasonal(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[int, float]:
    """Naive sazonal em log: último valor + variação média histórica para o mesmo mês-calendário."""
    if ctx.frequency != "monthly" or ctx.months is None:
        return m_naive(y, hs, ctx)
    n = len(y)
    out = {}
    for h in hs:
        diffs = []
        for k in range(1, 11):  # até 10 anos de mesma estação
            s = n - 1 - 12 * k
            if s < 0 or s + h >= n:
                break
            diffs.append(y[s + h] - y[s])
        out[h] = float(y[-1] + (np.mean(diffs) if diffs else 0.0))
    return out


def m_ets(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[int, float]:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    yy = y[-ctx.window :]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ExponentialSmoothing(yy, trend="add", damped_trend=True, initialization_method="estimated").fit()
        fc = fit.forecast(max(hs))
    return {h: float(fc[h - 1]) for h in hs}


def m_arima(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[int, float]:
    from statsmodels.tsa.arima.model import ARIMA

    yy = y[-ctx.window :]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ARIMA(yy, order=(1, 1, 1)).fit()
        fc = fit.forecast(max(hs))
    return {h: float(fc[h - 1]) for h in hs}


def m_ridge(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[int, float]:
    """Regressão linear regularizada (direta por horizonte) sobre retornos defasados (+ mês, se mensal)."""
    yy = y[-ctx.window :]
    r = np.diff(yy)
    p = 6 if ctx.frequency == "monthly" else 10
    months = ctx.months[-len(yy) :] if ctx.months is not None else None
    out = {}
    for h in hs:
        X, T = [], []
        for t in range(p, len(yy) - h):
            feats = list(r[t - p : t])
            if months is not None:
                feats += list(np.eye(12)[months[t] - 1])
            X.append(feats)
            T.append(yy[t + h] - yy[t])
        if len(X) < 24:
            out[h] = float(yy[-1])
            continue
        model = Ridge(alpha=1.0).fit(np.array(X), np.array(T))
        feats = list(r[-p:])
        if months is not None:
            feats += list(np.eye(12)[months[-1] - 1])
        out[h] = float(yy[-1] + model.predict(np.array([feats]))[0])
    return out


def m_ensemble(y: np.ndarray, hs: list[int], ctx: Ctx, parts: dict[str, dict[int, float]] | None = None) -> dict[int, float]:
    parts = parts or {k: MODELS[k](y, hs, ctx) for k in ("ets", "arima", "ridge")}
    return {h: float(np.median([parts[k][h] for k in ("ets", "arima", "ridge")])) for h in hs}


MODELS: dict[str, Callable[[np.ndarray, list[int], Ctx], dict[int, float]]] = {
    "naive": m_naive,
    "drift": m_drift,
    "seasonal": m_seasonal,
    "ets": m_ets,
    "arima": m_arima,
    "ridge": m_ridge,
}
MODEL_LABELS = {
    "naive": "Passeio aleatório (naive)",
    "drift": "Passeio aleatório com tendência (drift)",
    "seasonal": "Naive sazonal (variação média do mesmo mês)",
    "ets": "Suavização exponencial (Holt amortecido)",
    "arima": "ARIMA(1,1,1)",
    "ridge": "Regressão linear regularizada (Ridge) sobre retornos defasados",
    "ensemble": "Ensemble (mediana de ETS, ARIMA e Ridge)",
}


def run_all(y: np.ndarray, hs: list[int], ctx: Ctx) -> dict[str, dict[int, float]]:
    res = {}
    for name, fn in MODELS.items():
        if name == "seasonal" and ctx.frequency != "monthly":
            continue
        try:
            res[name] = fn(y, hs, ctx)
        except Exception as exc:  # noqa: BLE001 — um modelo que falha é excluído daquela origem
            log.debug("modelo %s falhou: %s", name, exc)
    if all(k in res for k in ("ets", "arima", "ridge")):
        res["ensemble"] = m_ensemble(y, hs, ctx, res)
    return res


# ----------------------------------------------------------------------------- métricas

def metrics(pred_log: np.ndarray, actual_log: np.ndarray, origin_log: np.ndarray) -> dict:
    p, a, o = np.exp(pred_log), np.exp(actual_log), np.exp(origin_log)
    err = p - a
    pct = np.abs(err) / a
    fc_dir = np.sign(pred_log - origin_log)
    act_dir = np.sign(actual_log - origin_log)
    mask = fc_dir != 0
    return {
        "n": int(len(a)),
        "mape": float(np.mean(pct)),
        "maeLog": float(np.mean(np.abs(pred_log - actual_log))),
        "rmseLog": float(np.sqrt(np.mean((pred_log - actual_log) ** 2))),
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err**2))),
        "directionalAccuracy": float(np.mean(fc_dir[mask] == act_dir[mask])) if mask.sum() >= 5 else None,
        "directionalN": int(mask.sum()),
    }


def diebold_mariano(e_model: np.ndarray, e_base: np.ndarray, overlap: int) -> float | None:
    """p-valor unilateral (H1: modelo tem erro absoluto menor que a baseline).

    Perda = |erro| em log. Variância HAC (Newey-West) com defasagem = sobreposição dos horizontes,
    correção de pequena amostra de Harvey, Leybourne & Newbold (1997) e distribuição t(n-1).
    """
    from scipy import stats

    d = np.abs(e_model) - np.abs(e_base)
    n = len(d)
    if n < 8:
        return None
    dbar = d.mean()
    dc = d - dbar
    lag = max(0, min(overlap, n - 2))
    gamma0 = np.dot(dc, dc) / n
    var = gamma0 + 2 * sum((1 - k / (lag + 1)) * np.dot(dc[k:], dc[:-k]) / n for k in range(1, lag + 1))
    if var <= 0:
        return None
    h = lag + 1
    stat = dbar / math.sqrt(var / n)
    stat *= math.sqrt(max((n + 1 - 2 * h + h * (h - 1) / n) / n, 1e-9))
    return float(stats.t.cdf(stat, df=n - 1))


# ----------------------------------------------------------------------------- motor

@dataclass
class SeriesInput:
    id: str
    frequency: str
    dates: list[str]
    values: list[float]


def _add_horizon(d: str, frequency: str, steps: int, days: int) -> str:
    base = datetime.fromisoformat(d).date()
    if frequency == "monthly":
        m = base.month - 1 + steps
        return date(base.year + m // 12, m % 12 + 1, 1).isoformat()
    return (base + timedelta(days=days)).isoformat()


def forecast_series(s: SeriesInput, today: date | None = None, n_eval: int | None = None) -> dict:
    today = today or date.today()
    y = np.log(np.asarray(s.values, dtype=float))
    n = len(y)
    monthly = s.frequency == "monthly"
    months = np.array([int(d[5:7]) for d in s.dates]) if monthly else None
    ctx = Ctx(frequency=s.frequency, months=months, window=240 if monthly else 750)
    min_obs = 72 if monthly else 500
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    result: dict = {
        "id": s.id, "frequency": s.frequency, "generatedAt": generated_at,
        "origin": {"date": s.dates[-1] if s.dates else None, "value": s.values[-1] if s.values else None},
        "observations": n, "horizons": {}, "method": {}, "signals": {},
    }
    if n < min_obs:
        for label in HORIZONS:
            result["horizons"][label] = {"status": "insufficient_data", "message": INSUFFICIENT_MSG,
                                         "reason": f"histórico de {n} observações (< {min_obs})"}
        return result

    step_idx = 0 if monthly else 1
    labels = [lb for lb, v in HORIZONS.items() if v[step_idx] is not None]
    hs = [HORIZONS[lb][step_idx] for lb in labels]
    max_h = max(hs)
    n_eval = n_eval or (60 if monthly else 40)
    stride = 1 if monthly else 15
    first_origin = n - 1 - max_h - (n_eval - 1) * stride
    first_origin = max(first_origin, min_obs // 2)
    origins = list(range(first_origin, n - 1, stride))
    preds: dict[str, dict[int, list[tuple[int, float]]]] = {}
    for o in origins:
        avail = [h for h in hs if o + h < n]
        if not avail:
            continue
        for name, fc in run_all(y[: o + 1], avail, ctx).items():
            for h, v in fc.items():
                preds.setdefault(name, {}).setdefault(h, []).append((o, v))

    final = run_all(y, hs, ctx)
    last_date = s.dates[-1]
    for label, h in zip(labels, hs):
        entry: dict = {"steps": h}
        base_rows = preds.get("naive", {}).get(h, [])
        if len(base_rows) < 12:
            entry.update(status="insufficient_data", message=INSUFFICIENT_MSG, reason="poucas origens de validação para este horizonte")
            result["horizons"][label] = entry
            continue
        half = len(base_rows) // 2
        sel_origins = {o for o, _ in base_rows[:half]}
        eval_origins = {o for o, _ in base_rows[half:]}

        def score(name: str, which: set[int]):
            rows = [(o, v) for o, v in preds.get(name, {}).get(h, []) if o in which]
            if len(rows) < max(6, len(which) // 2):
                return None, rows
            pl = np.array([v for _, v in rows])
            al = np.array([y[o + h] for o, _ in rows])
            ol = np.array([y[o] for o, _ in rows])
            return metrics(pl, al, ol), rows

        sel_scores = {}
        for name in preds:
            m, _ = score(name, sel_origins)
            if m:
                sel_scores[name] = m["maeLog"]
        chosen = min(sel_scores, key=sel_scores.get)
        eval_chosen, _ = score(chosen, eval_origins)
        if eval_chosen is None:  # modelo falhou em origens demais na avaliação → baseline
            chosen = "naive"
            eval_chosen, _ = score(chosen, eval_origins)
        eval_naive, _ = score("naive", eval_origins)
        skill = 1 - eval_chosen["maeLog"] / eval_naive["maeLog"] if eval_naive and eval_naive["maeLog"] > 0 else 0.0
        published = chosen
        fallback_note = None
        dm_p = None
        if chosen != "naive":
            em = np.array([y[o + h] - v for o, v in preds[chosen][h] if o in eval_origins])
            en = np.array([y[o + h] - v for o, v in preds["naive"][h] if o in eval_origins])
            k = min(len(em), len(en))
            overlap = math.ceil(h / stride) - 1
            dm_p = diebold_mariano(em[-k:], en[-k:], overlap)
            if skill <= 0:
                published = "naive"
                fallback_note = (f"O modelo selecionado ({MODEL_LABELS[chosen]}) não superou o passeio aleatório fora da amostra "
                                 f"(skill {skill:+.1%}); publicamos o passeio aleatório.")
            elif dm_p is None or dm_p >= 0.05:
                published = "naive"
                fallback_note = (f"{MODEL_LABELS[chosen]} teve erro {skill:.1%} menor que o passeio aleatório fora da amostra, mas o ganho "
                                 f"não é estatisticamente significativo (Diebold-Mariano p={'n/d' if dm_p is None else f'{dm_p:.2f}'}, exige p<0,05). "
                                 "Publicamos o passeio aleatório para não exagerar a confiança.")
        # Calibração do intervalo: erros da janela de seleção → cobertura medida na avaliação
        def errors(name: str, which: set[int]) -> np.ndarray:
            return np.array([y[o + h] - v for o, v in preds.get(name, {}).get(h, []) if o in which])

        e_sel = errors(published, sel_origins)
        q_lo, q_hi = np.quantile(e_sel, 0.10), np.quantile(e_sel, 0.90)
        e_eval = errors(published, eval_origins)
        coverage = float(np.mean((e_eval >= q_lo) & (e_eval <= q_hi))) if len(e_eval) else None
        # Intervalo publicado usa todas as origens (mais dados), com cobertura reportada acima
        e_all = errors(published, sel_origins | eval_origins)
        a_lo, a_hi = np.quantile(e_all, 0.10), np.quantile(e_all, 0.90)
        eval_pub, _ = score(published, eval_origins)

        central_log = final.get(published, final["naive"])[h]
        central = float(math.exp(central_log))
        low, high = float(math.exp(central_log + a_lo)), float(math.exp(central_log + a_hi))
        target_date = _add_horizon(last_date, s.frequency, h, HORIZONS[label][2])
        chg = central / s.values[-1] - 1
        half_width = (high - low) / 2 / s.values[-1]
        direction = "neutral" if abs(chg) < 0.25 * half_width else ("up" if chg > 0 else "down")

        entry.update(
            status="ok", targetDate=target_date, central=central, low=low, high=high,
            bullish=high, bearish=low, expectedChange=chg, intervalLevel=0.8, direction=direction,
            model=published, modelLabel=MODEL_LABELS[published], selectedByValidation=chosen,
            fallbackNote=fallback_note, skillVsNaive=skill if published == chosen else 0.0,
            dieboldMarianoP=dm_p, candidateSkill=skill,
            intervalWarning=(None if coverage is None or 0.6 <= coverage <= 0.95 else
                             f"Cobertura observada do intervalo de 80% foi {coverage:.0%} fora da amostra — calibração instável; trate a faixa com cautela."),
            beatsBaseline=bool(published != "naive" and skill > 0),
            evaluation={"selectionOrigins": len(sel_origins), "evaluationOrigins": len(eval_origins),
                        "model": eval_pub, "naive": eval_naive, "intervalCoverage": coverage,
                        "selectionScores": {k: round(v, 5) for k, v in sorted(sel_scores.items(), key=lambda kv: kv[1])}},
        )
        # Regras de publicação
        if label == "12m":
            years = n / (12 if monthly else 252)
            if years < 15 or coverage is None or not (0.65 <= coverage <= 0.95) or len(eval_origins) < 12:
                entry.update(status="not_justified", message=INSUFFICIENT_MSG,
                             reason=f"12 meses exige ≥15 anos de histórico e cobertura de intervalo entre 65% e 95% (histórico {years:.1f} anos; cobertura {coverage if coverage is None else round(coverage, 2)})")
        if entry["status"] == "ok" and target_date < today.isoformat():
            entry.update(status="expired", message="Horizonte já transcorrido: a fonte não publicou dados mais recentes. A previsão fica arquivada, mas não deve ser usada.")
        result["horizons"][label] = entry

    if monthly:
        result["horizons"]["7d"] = {"status": "frequency_mismatch", "message": INSUFFICIENT_MSG,
                                    "reason": "série mensal: horizonte de 7 dias exige dados diários licenciados"}
    result["method"] = {
        "candidates": [MODEL_LABELS[k] for k in preds],
        "window": ctx.window, "validation": "walk-forward com origens expansivas; seleção na 1ª metade das origens, métricas na 2ª metade",
        "interval": "quantis empíricos 10%–90% dos erros walk-forward (intervalo de 80%)",
        "originsStride": stride,
    }
    result["signals"] = _signals(y, months, monthly)
    return result


def _signals(y: np.ndarray, months: np.ndarray | None, monthly: bool) -> dict:
    """Sinais quantitativos descritivos (não são previsões): momento, regime de volatilidade, sazonalidade."""
    r = np.diff(y)
    per_year = 12 if monthly else 252
    k3 = 3 if monthly else 63
    out = {
        "momentum3": float(math.exp(y[-1] - y[-1 - k3]) - 1),
        "momentum12": float(math.exp(y[-1] - y[-1 - per_year]) - 1) if len(y) > per_year else None,
        "volRecent": float(np.std(r[-(12 if monthly else 63):], ddof=1) * math.sqrt(per_year)),
        "volLongRun": float(np.std(r[-(5 * per_year):], ddof=1) * math.sqrt(per_year)),
    }
    if monthly and months is not None and len(y) > 120:
        # fator sazonal: retorno médio por mês-calendário nos últimos 15 anos (log), com desvio-padrão
        rr = r[-180:]
        mm = months[1:][-180:]
        out["seasonality"] = [
            {"month": m, "meanReturn": float(np.mean(rr[mm == m])), "std": float(np.std(rr[mm == m], ddof=1)), "n": int((mm == m).sum())}
            for m in range(1, 13)
        ]
    return out
