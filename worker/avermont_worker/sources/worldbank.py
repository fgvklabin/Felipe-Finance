"""World Bank Commodity Price Data ("Pink Sheet"), séries mensais em US$ nominais.

Licença: Creative Commons Attribution 4.0 (CC BY 4.0) — uso comercial permitido com atribuição.
Atribuição exibida no app: "Fonte: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0".
"""
from __future__ import annotations

import logging
import re

import openpyxl

from ..config import WORLDBANK_PINK_SHEET_URL
from ..net import download

log = logging.getLogger("avermont.worldbank")


def _norm(name: str | None) -> str:
    if not name:
        return ""
    name = name.replace("*", "")
    return re.sub(r"\s+", " ", name).strip().lower()


def _period_to_date(p: str) -> str | None:
    m = re.fullmatch(r"(\d{4})M(\d{2})", str(p).strip())
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}-01"


def fetch(series_names: list[str]) -> dict:
    """Retorna {nome_series: {"unit": str, "points": [(date, value)]}, "_meta": {...}}."""
    path = download(WORLDBANK_PINK_SHEET_URL, max_age_hours=24)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Monthly Prices"]
    rows = list(ws.iter_rows(values_only=True))
    updated_note = next((str(r[0]) for r in rows[:6] if r and r[0] and "Updated" in str(r[0])), None)
    header_idx = next(i for i, r in enumerate(rows[:12]) if r and any(c and "Crude oil" in str(c) for c in r))
    names = rows[header_idx]
    units = rows[header_idx + 1]
    col_by_name = {_norm(n): i for i, n in enumerate(names) if n}
    out: dict = {"_meta": {"url": WORLDBANK_PINK_SHEET_URL, "sheetNote": updated_note}}
    for sname in series_names:
        idx = col_by_name.get(_norm(sname))
        if idx is None:
            log.warning("série não encontrada no Pink Sheet: %s", sname)
            continue
        pts = []
        for r in rows[header_idx + 2 :]:
            d = _period_to_date(r[0]) if r and r[0] else None
            if not d:
                continue
            v = r[idx]
            if isinstance(v, (int, float)):
                pts.append((d, float(v)))
        out[sname] = {"unit": units[idx], "points": pts}
    return out
