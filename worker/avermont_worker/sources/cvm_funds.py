"""CVM Dados Abertos — descoberta de fundos/ETFs/Fiagros com possível exposição a commodities e moedas.

Fontes: registro_fundo_classe.zip (cadastro pós-Resolução CVM 175), inf_diario_fi_AAAAMM.zip (cotas
diárias) e, quando disponível, lamina_fi_AAAAMM.zip (taxas e condições de resgate).

IMPORTANTE: a classificação de exposição é INFERIDA a partir do nome e da classe do fundo. A carteira
(CDA) não é analisada nesta versão — o app exibe isso explicitamente e o simulador não produz números
para exposições não verificadas.
"""
from __future__ import annotations

import csv
import io
import logging
import math
import re
import unicodedata
import zipfile
from datetime import date

import numpy as np
import pandas as pd

from ..config import CVM_BASE, FUND_MONTHS
from ..net import download

log = logging.getLogger("avermont.cvm_funds")

TAGS = {
    "ouro": r"\bOURO\b|\bGOLD\b",
    "petroleo": r"\bPETROLEO\b|\bOIL\b|\bBRENT\b",
    "energia": r"\bENERGIA\b|\bENERGY\b",
    "agro": r"\bAGRO\b|\bAGRONEGOCIO\b|\bAGRIBUSINESS\b|\bAGRICOLA\b",
    "acucar": r"\bACUCAR\b|\bSUGAR\b",
    "cafe": r"\bCAFE\b|\bCOFFEE\b",
    "metais": r"\bMETAIS\b|\bMETAL\b|\bMINERACAO\b|\bMINING\b",
    "commodities": r"\bCOMMODITIES\b|\bCOMMODITY\b",
    "dolar": r"\bDOLAR\b|\bUSD\b|\bCAMBIAL\b",
    "emergentes": r"\bEMERGENTES\b|\bEMERGING\b",
    "macro": r"\bMACRO\b",
}
_TAG_RE = {k: re.compile(v) for k, v in TAGS.items()}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return s.upper()


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _fmt_cnpj(d: str) -> str:
    d = d.zfill(14)
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


def _vehicle(tipo: str, classif: str) -> str | None:
    t = tipo.upper()
    if "FIIM" in t:
        return "etf"
    if "FIAGRO" in t:
        return "fiagro"
    if "FIF" in t and "FAPI" not in t:
        return {"Multimercado": "multimercado", "Ações": "acoes", "Cambial": "cambial"}.get(classif)
    return None


def _exposure_type(vehicle: str, tags: list[str]) -> str:
    commodity_tags = {"ouro", "petroleo", "energia", "agro", "acucar", "cafe", "metais", "commodities"}
    if vehicle == "etf" and commodity_tags & set(tags):
        return "direta_indice"
    if vehicle == "cambial":
        return "direta_cambial"
    if vehicle == "acoes":
        return "indireta_acoes"
    if vehicle == "fiagro":
        return "credito_ou_imoveis_agro"
    return "multimercado_nao_verificada"


def discover() -> list[dict]:
    zf = zipfile.ZipFile(download(f"{CVM_BASE}/FI/CAD/DADOS/registro_fundo_classe.zip", max_age_hours=72))
    fundos = {r["ID_Registro_Fundo"]: r for r in csv.DictReader(io.StringIO(zf.read("registro_fundo.csv").decode("latin1")), delimiter=";")}
    picked: dict[str, list[dict]] = {"tagged": [], "macro": [], "fiagro": [], "cambial": []}
    for r in csv.DictReader(io.StringIO(zf.read("registro_classe.csv").decode("latin1")), delimiter=";"):
        if r["Situacao"] != "Em Funcionamento Normal" or r["Exclusivo"] == "S":
            continue
        vehicle = _vehicle(r["Tipo_Classe"], r["Classificacao"])
        if vehicle is None:
            continue
        try:
            pl = float(r["Patrimonio_Liquido"] or 0)
        except ValueError:
            pl = 0.0
        if pl < 5_000_000:
            continue
        name = _norm(r["Denominacao_Social"])
        tags = [k for k, rx in _TAG_RE.items() if rx.search(name)]
        if vehicle == "cambial" and "dolar" not in tags:
            tags.append("dolar")
        f = fundos.get(r["ID_Registro_Fundo"], {})
        item = {
            "cnpj": _fmt_cnpj(_digits(r["CNPJ_Classe"])),
            "cnpjDigits": _digits(r["CNPJ_Classe"]).zfill(14),
            "name": r["Denominacao_Social"].strip(),
            "vehicle": vehicle,
            "classType": r["Tipo_Classe"],
            "classification": r["Classificacao"] or None,
            "anbimaClassification": r["Classificacao_Anbima"] or None,
            "benchmark": r["Indicador_Desempenho"] or None,
            "condominium": r["Forma_Condominio"] or None,
            "targetAudience": r["Publico_Alvo"] or None,
            "foreign100pct": r["Permitido_Aplicacao_CemPorCento_Exterior"] == "S",
            "netAssets": pl,
            "netAssetsDate": r["Data_Patrimonio_Liquido"] or None,
            "startDate": r["Data_Inicio"] or None,
            "manager": (f.get("Gestor") or "").strip() or None,
            "administrator": (f.get("Administrador") or "").strip() or None,
            "tags": tags,
            "exposureType": _exposure_type(vehicle, tags),
            "exposureBasis": "inferida do nome e da classe CVM; carteira (CDA) não analisada",
        }
        core = [t for t in tags if t != "macro"]
        if core:
            picked["tagged"].append(item)
        elif vehicle == "fiagro":
            picked["fiagro"].append(item)
        elif vehicle == "cambial":
            picked["cambial"].append(item)
        elif "macro" in tags and vehicle == "multimercado":
            picked["macro"].append(item)
    by_pl = lambda xs, n: sorted(xs, key=lambda x: -x["netAssets"])[:n]  # noqa: E731
    out = by_pl(picked["tagged"], 160) + by_pl(picked["cambial"], 40) + by_pl(picked["fiagro"], 40) + by_pl(picked["macro"], 40)
    seen, uniq = set(), []
    for f in out:
        if f["cnpjDigits"] not in seen:
            seen.add(f["cnpjDigits"])
            uniq.append(f)
    return uniq


def _months_back(n: int) -> list[str]:
    today = date.today()
    y, m = today.year, today.month
    out = []
    for _ in range(n):
        out.append(f"{y}{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def daily_quotas(cnpjs: set[str], months: int = FUND_MONTHS) -> pd.DataFrame:
    frames = []
    for ym in _months_back(months):
        url = f"{CVM_BASE}/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_{ym}.zip"
        try:
            path = download(url, max_age_hours=20 if ym == _months_back(1)[0] else 24 * 30)
        except Exception as exc:  # noqa: BLE001
            log.warning("informe diário %s indisponível: %s", ym, exc)
            continue
        with zipfile.ZipFile(path) as zf:
            for n in zf.namelist():
                df = pd.read_csv(zf.open(n), sep=";", encoding="latin1", dtype=str, on_bad_lines="skip")
                ccol = "CNPJ_FUNDO_CLASSE" if "CNPJ_FUNDO_CLASSE" in df.columns else "CNPJ_FUNDO"
                df["cnpjDigits"] = df[ccol].str.replace(r"\D", "", regex=True).str.zfill(14)
                df = df[df["cnpjDigits"].isin(cnpjs)]
                if "ID_SUBCLASSE" in df.columns:
                    # Usa a classe consolidada (sem subclasse) quando houver; senão a primeira subclasse
                    df["ID_SUBCLASSE"] = df["ID_SUBCLASSE"].fillna("")
                frames.append(df[["cnpjDigits", "DT_COMPTC", "VL_QUOTA", "VL_PATRIM_LIQ", "NR_COTST"] + (["ID_SUBCLASSE"] if "ID_SUBCLASSE" in df.columns else [])])
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames)
    if "ID_SUBCLASSE" in df.columns:
        first_sub = df.sort_values("ID_SUBCLASSE").groupby("cnpjDigits")["ID_SUBCLASSE"].first()
        df = df[df["ID_SUBCLASSE"] == df["cnpjDigits"].map(first_sub)]
    for c in ("VL_QUOTA", "VL_PATRIM_LIQ", "NR_COTST"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.drop_duplicates(["cnpjDigits", "DT_COMPTC"]).sort_values(["cnpjDigits", "DT_COMPTC"])


def performance(df: pd.DataFrame) -> dict[str, dict]:
    out = {}
    for cnpj, g in df.groupby("cnpjDigits"):
        g = g.dropna(subset=["VL_QUOTA"])
        g = g[g["VL_QUOTA"] > 0]
        if len(g) < 20:
            continue
        s = pd.Series(g["VL_QUOTA"].values, index=pd.to_datetime(g["DT_COMPTC"]))
        last_d, last = s.index[-1], s.iloc[-1]

        def ret_since(days: int):
            ref = s[s.index <= last_d - pd.Timedelta(days=days)]
            return float(last / ref.iloc[-1] - 1) if len(ref) else None

        prev_year = s[s.index < pd.Timestamp(year=last_d.year, month=1, day=1)]
        lr = np.diff(np.log(s.values))
        window = s[s.index >= last_d - pd.Timedelta(days=365)]
        dd = (window / window.cummax() - 1).min() if len(window) > 1 else None
        weekly = s.resample("W-FRI").last().dropna()
        out[cnpj] = {
            "quotaDate": last_d.date().isoformat(),
            "quota": float(last),
            "netAssetsDaily": float(g["VL_PATRIM_LIQ"].iloc[-1]) if not math.isnan(g["VL_PATRIM_LIQ"].iloc[-1]) else None,
            "shareholders": int(g["NR_COTST"].iloc[-1]) if not math.isnan(g["NR_COTST"].iloc[-1]) else None,
            "return1m": ret_since(30), "return3m": ret_since(91), "return6m": ret_since(182), "return12m": ret_since(365),
            "returnYtd": float(last / prev_year.iloc[-1] - 1) if len(prev_year) else None,
            "volatility12m": float(np.std(lr[-252:], ddof=1) * math.sqrt(252)) if len(lr) > 30 else None,
            "maxDrawdown12m": float(dd) if dd is not None else None,
            "observations": int(len(s)),
            "weekly": [[d.date().isoformat(), round(float(v), 6)] for d, v in weekly.items()],
        }
    return out


def lamina(cnpjs: set[str]) -> dict[str, dict]:
    """Taxas e condições a partir da lâmina mais recente disponível (se o arquivo existir)."""
    for ym in _months_back(4):
        url = f"{CVM_BASE}/FI/DOC/LAMINA/DADOS/lamina_fi_{ym}.zip"
        try:
            path = download(url, max_age_hours=24 * 7)
        except Exception:  # noqa: BLE001
            continue
        with zipfile.ZipFile(path) as zf:
            name = next((n for n in zf.namelist() if re.fullmatch(r"lamina_fi_\d{6}\.csv", n)), None)
            if not name:
                continue
            df = pd.read_csv(zf.open(name), sep=";", encoding="latin1", dtype=str, on_bad_lines="skip")  # lâminas têm texto livre malformado
        ccol = "CNPJ_FUNDO_CLASSE" if "CNPJ_FUNDO_CLASSE" in df.columns else "CNPJ_FUNDO"
        df["cnpjDigits"] = df[ccol].str.replace(r"\D", "", regex=True).str.zfill(14)
        df = df[df["cnpjDigits"].isin(cnpjs)]
        cols = {
            "TAXA_ADM": "managementFee", "TAXA_ADM_MAX": "managementFeeMax", "TAXA_PERFM": "performanceFee",
            "VL_MIN_APLIC_INIC": "minimumInvestment", "QT_DIA_CONVERSAO_COTA": "redemptionConversionDays",
            "QT_DIA_PAGTO_RESGATE": "redemptionPaymentDays", "OBJETIVO": "objective", "POLIT_INVEST": "investmentPolicy",
            "DS_TAXA_PERFM": "performanceFeeDescription", "CLASSE_RISCO_ADMIN": "riskClass",
        }
        out = {}
        for _, r in df.iterrows():
            rec = {"laminaMonth": ym}
            for src, dst in cols.items():
                if src in df.columns and isinstance(r.get(src), str) and r.get(src).strip():
                    rec[dst] = r[src].strip()[:600]
            out[r["cnpjDigits"]] = rec
        log.info("lâmina %s: %d fundos com dados", ym, len(out))
        return out
    return {}


def fetch() -> dict:
    funds = discover()
    cnpjs = {f["cnpjDigits"] for f in funds}
    perf = performance(daily_quotas(cnpjs))
    lam = lamina(cnpjs)
    for f in funds:
        f["performance"] = perf.get(f["cnpjDigits"])
        f["documents"] = lam.get(f["cnpjDigits"])
    return {"funds": funds}
