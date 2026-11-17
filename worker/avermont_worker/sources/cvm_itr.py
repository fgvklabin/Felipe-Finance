"""CVM Dados Abertos — Informações Trimestrais (ITR) de companhias abertas.

Resultados por trimestre (consolidado):
  * DRE: usa as linhas do trimestre isolado (início = 1º dia do trimestre; no 1º trimestre do exercício o acumulado é o próprio trimestre);
  * último trimestre do exercício: não existe ITR — calculado como exercício anual (DFP) menos o acumulado de 9 meses;
  * D&A (DFC, método indireto) só é publicada acumulada no ano → trimestre = diferença entre acumulados;
  * Balanço (caixa, aplicações, empréstimos) na data de fim do trimestre;
  * Quando o mesmo período aparece em mais de um documento (ex.: comparativo reapresentado), vale o documento mais recente.
"""
from __future__ import annotations

import csv
import io
import logging
import re
import zipfile
from datetime import date

from ..config import CVM_BASE
from ..net import download

log = logging.getLogger("avermont.cvm_itr")

DRE = {"3.01": "revenue", "3.05": "ebit", "3.11": "netIncome"}
BAL = {"1.01.01": "cash", "1.01.02": "shortTermInvestments", "2.01.04": "debtCurrent", "2.02.01": "debtNonCurrent"}
_DA = re.compile(r"deprecia|amortiza|exaust", re.I)


def _scale(r: dict) -> float:
    return 1000.0 if (r.get("ESCALA_MOEDA") or "").upper() == "MIL" else 1.0


_QEND = {3: "03-31", 6: "06-30", 9: "09-30", 12: "12-31"}


def _is_qend(end: str) -> bool:
    return end[5:] in _QEND.values()


def _q_start(end: str) -> str:
    m = int(end[5:7])
    return f"{end[:4]}-{m - 2:02d}-01"


def _prev_end(end: str) -> str:
    y, m = int(end[:4]), int(end[5:7]) - 3
    if m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{_QEND[m]}"


def _fy_start(fy_end: str) -> str:
    """Início do exercício que termina em fy_end (12 meses)."""
    d = date.fromisoformat(fy_end)
    nxt = date(d.year - 1, d.month, d.day).toordinal() + 1
    return date.fromordinal(nxt).isoformat()


def period_label(end: str) -> str:
    """Trimestre CIVIL do fim do período: 2026-09-30 → 2026T3 (comparável entre empresas com exercícios diferentes)."""
    return f"{end[:4]}T{int(end[5:7]) // 3}"


def _pick(rows: list[dict], cnpjs: set[str], accept) -> dict[tuple, float]:
    """(cnpj, início, fim, chave) → valor, do documento mais recente (DT_REFER, VERSAO)."""
    best: dict[tuple, tuple[tuple, float]] = {}
    for r in rows:
        if r["CNPJ_CIA"] not in cnpjs:
            continue
        key = accept(r)
        if key is None:
            continue
        k = (r["CNPJ_CIA"], r.get("DT_INI_EXERC") or "", r["DT_FIM_EXERC"], key)
        rank = (r["DT_REFER"], int(r["VERSAO"] or 0))
        val = float(r["VL_CONTA"]) * _scale(r)
        cur = best.get(k)
        if cur is None or rank > cur[0]:
            best[k] = (rank, val)
        elif rank == cur[0] and key == "da":
            best[k] = (rank, cur[1] + val)  # várias linhas de D&A no mesmo documento: soma
    return {k: v for k, (_, v) in best.items()}


def _da_rows(rows: list[dict]) -> list[dict]:
    return [r | {"VL_CONTA": str(abs(float(r["VL_CONTA"])))} for r in rows if r["CD_CONTA"].startswith("6.01.01.") and _DA.search(r["DS_CONTA"] or "")]


def build_quarters(dre: list[dict], dfc: list[dict], bal: list[dict], annual: dict[str, list[dict]], cnpjs: set[str], keep: int = 8) -> dict[str, list[dict]]:
    """Função pura: linhas CSV da CVM (ITR) + exercícios anuais (DFP, com fiscalYearEnd) → trimestres por CNPJ.

    Funciona para exercícios que não terminam em dezembro (ex.: usinas com ano-safra abril–março).
    """
    inc = _pick(dre, cnpjs, lambda r: DRE.get(r["CD_CONTA"]))
    da = _pick(_da_rows(dfc), cnpjs, lambda r: "da")
    bs = _pick(bal, cnpjs, lambda r: BAL.get(r["CD_CONTA"]))
    out: dict[str, list[dict]] = {}
    for cnpj in cnpjs:
        ann = {a["fiscalYearEnd"]: a for a in annual.get(cnpj, []) if a.get("fiscalYearEnd")}
        itr_ends = {k[2] for k in inc if k[0] == cnpj and _is_qend(k[2])}
        if not itr_ends:
            out[cnpj] = []
            continue
        first = min(itr_ends)
        ends = sorted(e for e in itr_ends | set(ann) if _is_qend(e) and e >= first)
        quarters = []
        for e in ends:
            qs, pe = _q_start(e), _prev_end(e)
            row: dict = {"period": period_label(e), "end": e}
            a = ann.get(e)
            vals = {key: inc.get((cnpj, qs, e, key)) for key in DRE.values()}
            if vals["revenue"] is not None:
                row.update({k: v for k, v in vals.items() if v is not None})
                row["source"] = "ITR"
            elif a:
                fs = _fy_start(e)
                for key in DRE.values():
                    nine = inc.get((cnpj, fs, pe, key))
                    if key in a and nine is not None:
                        row[key] = a[key] - nine
                row["source"] = "DFP − ITR 9 meses"
            if "revenue" not in row:
                continue
            # D&A só existe acumulada no exercício: trimestre = acumulado até e − acumulado até o trimestre anterior
            if a:
                fs, cum = _fy_start(e), a.get("depreciationAmortization")
            else:
                starts = sorted(k[1] for k in da if k[0] == cnpj and k[2] == e and k[1] and k[1] <= qs)
                fs = starts[0] if starts else None
                cum = da.get((cnpj, fs, e, "da")) if fs else None
            prev = 0.0 if fs == qs else (da.get((cnpj, fs, pe, "da")) if fs else None)
            if cum is not None and prev is not None:
                row["depreciationAmortization"] = cum - prev
            # Balanço na data
            b = {k: a[k] for k in BAL.values() if k in a} if a else {k: v for k in BAL.values() if (v := bs.get((cnpj, "", e, k))) is not None}
            if "debtCurrent" in b or "debtNonCurrent" in b:
                row["netDebt"] = b.get("debtCurrent", 0.0) + b.get("debtNonCurrent", 0.0) - b.get("cash", 0.0) - b.get("shortTermInvestments", 0.0)
            if "ebit" in row and "depreciationAmortization" in row:
                row["ebitdaCalculated"] = row["ebit"] + row["depreciationAmortization"]
            if row["revenue"]:
                for k in ("ebit", "netIncome", "ebitdaCalculated"):
                    if k in row:
                        row[f"{k}Margin"] = row[k] / row["revenue"]
            quarters.append(row)
        by = {r["period"]: r for r in quarters}
        for r in quarters:
            ly = by.get(f"{int(r['period'][:4]) - 1}T{r['period'][-1]}")
            if ly and ly.get("revenue"):
                r["revenueYoY"] = r["revenue"] / ly["revenue"] - 1
            if ly and "netIncome" in ly:
                r["netIncomePrevYear"] = ly["netIncome"]
        out[cnpj] = quarters[-keep:]
    return out


def _csv(zf: zipfile.ZipFile, part: str) -> list[dict]:
    name = next((n for n in zf.namelist() if part in n), None)
    if not name:
        return []
    return list(csv.DictReader(io.StringIO(zf.read(name).decode("latin1")), delimiter=";"))


def fetch(cnpjs: set[str], annual: dict[str, list[dict]]) -> tuple[dict[str, list[dict]], list[int]]:
    year = date.today().year
    dre, dfc, bal, loaded = [], [], [], []
    for y in (year - 1, year):
        try:
            zf = zipfile.ZipFile(download(f"{CVM_BASE}/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_{y}.zip", max_age_hours=72))
        except Exception as exc:  # noqa: BLE001
            log.warning("ITR %s indisponível: %s", y, exc)
            continue
        loaded.append(y)
        keep = lambda rows: [r for r in rows if r["CNPJ_CIA"] in cnpjs]  # noqa: E731
        dre += keep(_csv(zf, "_DRE_con_"))
        dfc += keep(_csv(zf, "_DFC_MI_con_"))
        # Balanço: só a posição na data de referência (ÚLTIMO); sem DT_INI_EXERC
        bal += [r | {"DT_INI_EXERC": ""} for r in keep(_csv(zf, "_BPA_con_") + _csv(zf, "_BPP_con_")) if r.get("ORDEM_EXERC", "").startswith("Ú")]
    return build_quarters(dre, dfc, bal, annual, cnpjs), loaded
