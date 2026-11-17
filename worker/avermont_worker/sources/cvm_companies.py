"""CVM Dados Abertos — cadastro (FCA) e demonstrações financeiras padronizadas (DFP) de companhias abertas.

Tudo aqui vem de arquivos oficiais da CVM (dados.cvm.gov.br, licença de dados abertos do governo federal).
Nenhum ticker ou CNPJ é aceito sem conferência no FCA: divergências são reportadas, não corrigidas.
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
from . import cvm_itr

log = logging.getLogger("avermont.cvm_companies")

# Universo inicial: (ticker(s) informado(s), CNPJ esperado). Ambos são VERIFICADOS contra o FCA.
UNIVERSE = [
    (["KLBN11"], "89.637.490/0001-45"),
    (["SUZB3"], "16.404.287/0001-55"),
    (["VALE3"], "33.592.510/0001-54"),
    (["PETR3", "PETR4"], "33.000.167/0001-01"),
    (["GGBR4"], "33.611.500/0001-19"),
    (["CSNA3"], "33.042.730/0001-04"),
    (["USIM5"], "60.894.730/0001-05"),
    (["CBAV3"], "61.409.892/0001-73"),
    (["SLCE3"], "89.096.457/0001-55"),
    (["AGRO3"], "07.628.528/0001-59"),
    (["SMTO3"], "51.466.860/0001-56"),
    (["TTEN3"], "94.813.102/0001-70"),
    (["JALL3"], "02.635.522/0001-95"),
]

ACCOUNTS = {
    "DRE": {"3.01": "revenue", "3.03": "grossProfit", "3.05": "ebit", "3.06": "financialResult", "3.11": "netIncome"},
    "BPA": {"1": "totalAssets", "1.01.01": "cash", "1.01.02": "shortTermInvestments"},
    "BPP": {"2.01.04": "debtCurrent", "2.02.01": "debtNonCurrent", "2.03": "equity"},
}
_DA = re.compile(r"deprecia|amortiza|exaust", re.I)


def _read_zip_csv(zf: zipfile.ZipFile, name_part: str) -> list[dict]:
    name = next(n for n in zf.namelist() if name_part in n)
    text = zf.read(name).decode("latin1")
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


def _scale(row: dict) -> float:
    return 1000.0 if row.get("ESCALA_MOEDA", "").upper() == "MIL" else 1.0


def fetch() -> dict:
    year = date.today().year
    cnpjs = {c for _, c in UNIVERSE}
    # FCA mais recente disponível (ano corrente; se ausente, ano anterior)
    fca = None
    for y in (year, year - 1):
        try:
            fca = zipfile.ZipFile(download(f"{CVM_BASE}/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_{y}.zip", max_age_hours=72))
            fca_year = y
            break
        except Exception as exc:  # noqa: BLE001
            log.warning("FCA %s indisponível: %s", y, exc)
    if fca is None:
        raise RuntimeError("FCA indisponível")
    geral = {}
    for r in _read_zip_csv(fca, "fca_cia_aberta_geral"):
        if r["CNPJ_Companhia"] in cnpjs:
            prev = geral.get(r["CNPJ_Companhia"])
            if prev is None or int(r["Versao"] or 0) >= int(prev["Versao"] or 0):
                geral[r["CNPJ_Companhia"]] = r
    tickers: dict[str, list[dict]] = {}
    for r in _read_zip_csv(fca, "fca_cia_aberta_valor_mobiliario"):
        if r["CNPJ_Companhia"] in cnpjs and r["Codigo_Negociacao"] and not r["Data_Fim_Negociacao"]:
            tickers.setdefault(r["CNPJ_Companhia"], [])
            if r["Codigo_Negociacao"] not in [t["code"] for t in tickers[r["CNPJ_Companhia"]]]:
                tickers[r["CNPJ_Companhia"]].append({
                    "code": r["Codigo_Negociacao"], "security": r["Valor_Mobiliario"],
                    "segment": r["Segmento"], "composition": r["Composicao_BDR_Unit"] or None,
                })

    # DFP: arquivo do ano X traz exercícios X (ÚLTIMO) e X-1 (PENÚLTIMO)
    fin: dict[str, dict[str, dict]] = {c: {} for c in cnpjs}
    dfp_years_loaded = []
    # ano corrente: exercícios encerrados em março/junho (ex.: usinas com ano-safra) já entregues
    for y in (year, year - 1, year - 3):
        try:
            zf = zipfile.ZipFile(download(f"{CVM_BASE}/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_{y}.zip", max_age_hours=72))
        except Exception as exc:  # noqa: BLE001
            log.warning("DFP %s indisponível: %s", y, exc)
            continue
        dfp_years_loaded.append(y)
        for stmt, accounts in ACCOUNTS.items():
            for r in _read_zip_csv(zf, f"_{stmt}_con_"):
                if r["CNPJ_CIA"] not in cnpjs or r["CD_CONTA"] not in accounts:
                    continue
                fy = r["DT_FIM_EXERC"][:4]
                slot = fin[r["CNPJ_CIA"]].setdefault(fy, {"fiscalYearEnd": r["DT_FIM_EXERC"], "currency": r["MOEDA"]})
                key = accounts[r["CD_CONTA"]]
                # Mantém o valor da versão mais recente do documento
                ver = int(r["VERSAO"] or 0)
                if slot.get(f"_v_{key}", -1) <= ver:
                    slot[key] = float(r["VL_CONTA"]) * _scale(r)
                    slot[f"_v_{key}"] = ver
        # D&A pela DFC (método indireto): ajustes 6.01.01.* com descrição de depreciação/amortização/exaustão
        for r in _read_zip_csv(zf, "_DFC_MI_con_"):
            if r["CNPJ_CIA"] not in cnpjs or not r["CD_CONTA"].startswith("6.01.01.") or not _DA.search(r["DS_CONTA"]):
                continue
            fy = r["DT_FIM_EXERC"][:4]
            slot = fin[r["CNPJ_CIA"]].setdefault(fy, {"fiscalYearEnd": r["DT_FIM_EXERC"]})
            tag = f"_da_{r['CD_CONTA']}_{r['VERSAO']}"
            if tag not in slot:
                slot[tag] = True
                slot["depreciationAmortization"] = slot.get("depreciationAmortization", 0.0) + abs(float(r["VL_CONTA"]) * _scale(r))

    companies = []
    for given_tickers, cnpj in UNIVERSE:
        g = geral.get(cnpj)
        verified_codes = [t["code"] for t in tickers.get(cnpj, [])]
        years = []
        for fy, s in sorted(fin[cnpj].items()):
            clean = {k: v for k, v in s.items() if not k.startswith("_")}
            if "ebit" in clean and "depreciationAmortization" in clean:
                clean["ebitdaCalculated"] = clean["ebit"] + clean["depreciationAmortization"]
            debt = clean.get("debtCurrent", 0.0) + clean.get("debtNonCurrent", 0.0)
            if "debtCurrent" in clean or "debtNonCurrent" in clean:
                clean["grossDebt"] = debt
                clean["netDebt"] = debt - clean.get("cash", 0.0) - clean.get("shortTermInvestments", 0.0)
            if clean.get("revenue"):
                for k in ("grossProfit", "ebit", "netIncome", "ebitdaCalculated"):
                    if k in clean:
                        clean[f"{k}Margin"] = clean[k] / clean["revenue"]
            clean["fiscalYear"] = int(fy)
            years.append(clean)
        companies.append({
            "cnpj": cnpj,
            "tickersGiven": given_tickers,
            "tickersVerified": [t for t in given_tickers if t in verified_codes],
            "tickersMismatch": [t for t in given_tickers if t not in verified_codes],
            "securities": tickers.get(cnpj, []),
            "name": g["Nome_Empresarial"] if g else None,
            "cvmCode": g["Codigo_CVM"] if g else None,
            "registrationStatus": g["Situacao_Registro_CVM"] if g else "não encontrado no FCA",
            "issuerStatus": g["Situacao_Emissor"] if g else None,
            "sector": g["Setor_Atividade"] if g else None,
            "activityDescription": g["Descricao_Atividade"] if g else None,
            "control": g["Especie_Controle_Acionario"] if g else None,
            "website": g["Pagina_Web"] if g else None,
            "fcaReferenceDate": g["Data_Referencia"] if g else None,
            "financials": years,
        })
    # Resultados trimestrais (ITR); o último trimestre do exercício vem de DFP − 9 meses
    try:
        quarters, itr_loaded = cvm_itr.fetch(cnpjs, {c["cnpj"]: c["financials"] for c in companies})
    except Exception as exc:  # noqa: BLE001
        log.warning("ITR indisponível: %s", exc)
        quarters, itr_loaded = {}, []
    for c in companies:
        c["quarters"] = quarters.get(c["cnpj"], [])
    return {"fcaYear": fca_year, "dfpFilesLoaded": dfp_years_loaded, "itrFilesLoaded": itr_loaded, "companies": companies}
