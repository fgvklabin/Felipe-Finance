"""Banco Central Europeu — taxas de câmbio de referência (EXR), via ECB Data Portal API.

As taxas do BCE são publicadas para fins de informação; reutilização permitida com citação da fonte.
Taxas cruzadas (CNY/BRL, AUD/USD, USD/CAD, USD/NOK) e a réplica do índice do dólar são DERIVADAS
pela Avermont e rotuladas como tal no app.
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import date, timedelta

from ..config import DAILY_HISTORY_YEARS, ECB_EXR_URL
from ..net import get_text

log = logging.getLogger("avermont.ecb")

CURRENCIES = ["USD", "BRL", "CNY", "AUD", "CAD", "NOK", "JPY", "GBP", "SEK", "CHF"]


def fetch_rates(years: int = DAILY_HISTORY_YEARS) -> dict[str, dict[str, float]]:
    """{moeda: {data: unidades da moeda por 1 EUR}}"""
    start = (date.today() - timedelta(days=int(365.25 * years))).isoformat()
    key = "D." + "+".join(CURRENCIES) + ".EUR.SP00.A"
    text = get_text(f"{ECB_EXR_URL}/{key}", params={"startPeriod": start, "format": "csvdata"}, timeout=180)
    out: dict[str, dict[str, float]] = {c: {} for c in CURRENCIES}
    for row in csv.DictReader(io.StringIO(text)):
        try:
            out[row["CURRENCY"]][row["TIME_PERIOD"]] = float(row["OBS_VALUE"])
        except (KeyError, ValueError):
            continue
    return out


def cross(rates: dict[str, dict[str, float]], base: str, quote: str) -> list[tuple[str, float]]:
    """Cotação BASE/QUOTE = unidades de QUOTE por 1 BASE, a partir de taxas por EUR."""
    qb = rates[base]
    qq = rates[quote]
    days = sorted(set(qb) & set(qq))
    return [(d, qq[d] / qb[d]) for d in days]


# Fórmula pública do índice do dólar (pesos ICE). Calculada aqui como réplica, não índice oficial.
_DXY_WEIGHTS = {"EURUSD": -0.576, "USDJPY": 0.136, "GBPUSD": -0.119, "USDCAD": 0.091, "USDSEK": 0.042, "USDCHF": 0.036}


def dxy_replica(rates: dict[str, dict[str, float]]) -> list[tuple[str, float]]:
    usd = rates["USD"]
    days = sorted(set(usd) & set(rates["JPY"]) & set(rates["GBP"]) & set(rates["CAD"]) & set(rates["SEK"]) & set(rates["CHF"]))
    out = []
    for d in days:
        eurusd = usd[d]
        usdjpy = rates["JPY"][d] / usd[d]
        gbpusd = usd[d] / rates["GBP"][d]
        usdcad = rates["CAD"][d] / usd[d]
        usdsek = rates["SEK"][d] / usd[d]
        usdchf = rates["CHF"][d] / usd[d]
        v = 50.14348112
        for pair, w in (("EURUSD", eurusd), ("USDJPY", usdjpy), ("GBPUSD", gbpusd), ("USDCAD", usdcad), ("USDSEK", usdsek), ("USDCHF", usdchf)):
            v *= w ** _DXY_WEIGHTS[pair]
        out.append((d, v))
    return out
