"""CVM — Composição e Diversificação das Aplicações (CDA): carteira divulgada mensalmente pelos fundos.

Transforma a exposição "inferida pelo nome" em exposição VERIFICADA na carteira:
  * peso de cada ativo = valor de mercado / patrimônio líquido informado no CDA;
  * cotas de outros fundos: look-through de um nível quando o fundo investido também publica CDA;
  * ações de produtoras, fundos/ETFs de ouro, petróleo etc. (Brasil e exterior) → exposição com peso;
  * contratos futuros → apenas DIREÇÃO (comprado/vendido): o CDA informa o ajuste, não o tamanho da posição;
  * posições confidenciais (até 90 dias) são reportadas como parcela não divulgada.
"""
from __future__ import annotations

import logging
import re
import zipfile
from datetime import date

import pandas as pd

from ..config import CVM_BASE
from ..net import download

log = logging.getLogger("avermont.cda")

# Ações de companhias com receita ligada a commodities (mapeamento Avermont; raiz do ticker → commodities).
STOCK_COMMODITY: dict[str, list[str]] = {
    "VALE": ["minerio-ferro", "niquel", "cobre"], "BRAP": ["minerio-ferro"], "CMIN": ["minerio-ferro"],
    "PETR": ["brent"], "PRIO": ["brent"], "RECV": ["brent"], "BRAV": ["brent"],
    "SUZB": ["celulose-fibra-curta"], "KLBN": ["celulose-fibra-curta", "papel-kraft"],
    "GGBR": ["aco"], "GOAU": ["aco"], "CSNA": ["aco", "minerio-ferro"], "USIM": ["aco"], "CBAV": ["aluminio"],
    "SLCE": ["soja", "algodao", "milho"], "AGRO": ["soja", "milho"], "TTEN": ["soja", "farelo-soja", "oleo-soja"],
    "SMTO": ["acucar", "etanol"], "JALL": ["acucar", "etanol"], "RAIZ": ["acucar", "etanol"],
    "AURA": ["ouro"],
}

# Raízes de contratos futuros da B3 → exposição
def _fut(roots: str, words: str) -> re.Pattern:
    # Código B3: raiz + (opcional) letras/vencimento, ex.: DOLZ26, WDOX26, GLDFZ26, "FUT GLD/Z26"
    return re.compile(rf"\b(?:{roots})(?:[A-Z]{{0,2}}\d{{2}})?\b|\b(?:{roots})/|{words}", re.I)


FUTURES: list[tuple[re.Pattern, str]] = [
    (_fut("DOL|WDO", r"D[OÓ]LAR COMERCIAL"), "usdbrl"),
    (_fut("GLD|OZ1", r"\bOURO\b"), "ouro"),
    (_fut("ICF|KFE", r"CAF[EÉ]"), "cafe-arabica"),
    (_fut("CCM", r"\bMILHO\b"), "milho"),
    (_fut("SJC|SFI", r"\bSOJA\b"), "soja"),
    (_fut("ETN", r"ETANOL"), "etanol"),
]

# Palavras-chave em nomes de fundos investidos / ativos no exterior
KEYWORDS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bOURO\b|\bGOLD\b|\bGLD\b|\bIAU\b|\bLBMA\b", re.I), "ouro"),
    (re.compile(r"\bSILVER\b|\bPRATA\b|\bSLV\b", re.I), "prata"),
    (re.compile(r"\bBRENT\b|\bCRUDE\b|\bPETR[OÓ]LEO\b|\bUSO\b|\bBNO\b|\bOIL\b", re.I), "brent"),
    (re.compile(r"\bCOPPER\b|\bCOBRE\b|\bCPER\b", re.I), "cobre"),
    (re.compile(r"\bCAMBIAL\b|\bD[OÓ]LAR\b", re.I), "usdbrl"),
]

TICKER = re.compile(r"\b([A-Z]{4})(3|4|5|6|11|33|34)\b")


def _months_back(n: int) -> list[str]:
    y, m = date.today().year, date.today().month
    out = []
    for _ in range(n):
        out.append(f"{y}{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def _num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.str.replace(",", ".", regex=False), errors="coerce")


def _load_month(ym: str, cnpjs: set[str]) -> dict | None:
    try:
        path = download(f"{CVM_BASE}/FI/DOC/CDA/DADOS/cda_fi_{ym}.zip", max_age_hours=24 * 7)
    except Exception as exc:  # noqa: BLE001
        log.info("CDA %s indisponível: %s", ym, exc)
        return None
    rows, pl, conf = [], {}, {}
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        read = lambda n: pd.read_csv(zf.open(n), sep=";", encoding="latin1", dtype=str, on_bad_lines="skip")  # noqa: E731
        # 1ª passada: fundos investidos pelos nossos fundos (para o look-through)
        targets = set(cnpjs)
        for name in names:
            if "BLC_2" in name:
                df = read(name)
                df["cnpj"] = df["CNPJ_FUNDO_CLASSE"].str.replace(r"\D", "", regex=True).str.zfill(14)
                cotas = df.loc[df["cnpj"].isin(cnpjs), "CNPJ_FUNDO_CLASSE_COTA"].dropna().str.replace(r"\D", "", regex=True).str.zfill(14)
                targets |= set(cotas)
        for name in names:
            df = read(name)
            df["cnpj"] = df["CNPJ_FUNDO_CLASSE"].str.replace(r"\D", "", regex=True).str.zfill(14)
            df = df[df["cnpj"].isin(cnpjs if "CONFID" in name else targets)]
            if df.empty:
                continue
            if "_PL_" in name:
                for c, v in zip(df["cnpj"], _num(df["VL_PATRIM_LIQ"])):
                    if pd.notna(v):
                        pl[c] = float(v)
                continue
            df["value"] = _num(df["VL_MERC_POS_FINAL"])
            if "CONFID" in name:
                for c, v in df.groupby("cnpj")["value"].sum().items():
                    conf[c] = conf.get(c, 0.0) + float(v)
                continue
            if "CNPJ_FUNDO_CLASSE_COTA" in df.columns:
                df["cota"] = df["CNPJ_FUNDO_CLASSE_COTA"].str.replace(r"\D", "", regex=True).str.zfill(14)
            block = re.search(r"(BLC_\d|fie)", name).group(1)
            for r in df.to_dict("records"):
                desc = " ".join(str(r.get(k)) for k in ("CD_ATIVO", "DS_ATIVO", "NM_FUNDO_CLASSE_SUBCLASSE_COTA", "DS_ATIVO_EXTERIOR", "EMISSOR", "CD_ATIVO_BV_MERC") if isinstance(r.get(k), str))
                rows.append({"cnpj": r["cnpj"], "block": block, "aplic": r.get("TP_APLIC") or "", "ativo": r.get("TP_ATIVO") or "", "desc": desc.strip(), "value": r["value"],
                             "cota": r.get("cota") if isinstance(r.get("cota"), str) else None, "pais": r.get("PAIS") if isinstance(r.get("PAIS"), str) else None})
    return {"month": ym, "rows": pd.DataFrame(rows), "pl": pl, "conf": conf}


def _classify(r: dict) -> tuple[str | None, list[str], str | None]:
    """Retorna (tipo, commodities, lado) para uma posição."""
    aplic, desc = r["aplic"], r["desc"]
    if "Futuro" in aplic:
        side = "short" if "vendid" in aplic.lower() else "long"
        for rx, c in FUTURES:
            if rx.search(desc):
                return "futures", [c], side
        return "futures", [], side
    if aplic.startswith("Ações") or "BDR" in aplic or "Brazilian Depository" in aplic:
        m = TICKER.search(desc.upper())
        if m and m.group(1) in STOCK_COMMODITY:
            return "stock", STOCK_COMMODITY[m.group(1)], "long"
        return "stock", [], "long"
    hits = [c for rx, c in KEYWORDS if rx.search(desc)]
    foreign = r["block"] == "BLC_7" or "exterior" in aplic.lower() or (r.get("pais") if isinstance(r.get("pais"), str) else "").strip().lower() not in ("brasil", "brazil", "")
    if foreign:
        # ativo no exterior: exposição ao tema (se houver) e ao dólar (hedge cambial não é informado no CDA)
        return "foreign", [c for c in hits if c != "usdbrl"] + ["usdbrl"], "long"
    if r["block"] == "BLC_2":
        return "fund", hits, "long"
    if hits and r["block"] in ("BLC_8", "fie"):
        return "other", [c for c in hits if c != "usdbrl"], "long"
    return None, [], None


def holdings(cnpjs: set[str], months: int = 3) -> dict[str, dict]:
    loaded = [m for m in (_load_month(ym, cnpjs) for ym in _months_back(months + 1)) if m is not None][:months]
    out: dict[str, dict] = {}
    for cnpj in cnpjs:
        for mon in loaded:  # mês mais recente com carteira aberta relevante
            df = mon["rows"]
            own = df[df["cnpj"] == cnpj] if not df.empty else df
            pl = mon["pl"].get(cnpj) or (float(own["value"].sum()) if len(own) else 0.0)
            if pl <= 0 or own.empty:
                continue
            conf_share = mon["conf"].get(cnpj, 0.0) / pl
            if conf_share > 0.5 and mon is not loaded[-1]:
                continue
            exposures: dict[str, dict] = {}
            positions = []
            futures = []

            def add(c: str, w: float | None, via: str, side: str):
                e = exposures.setdefault(c, {"weight": 0.0, "via": [], "byVia": {}, "side": side, "weighted": False})
                if w is not None:
                    signed = w if side == "long" else -w
                    e["weight"] += signed
                    e["byVia"][via] = round(e["byVia"].get(via, 0.0) + signed, 6)
                    e["weighted"] = True
                if via not in e["via"]:
                    e["via"].append(via)
                if side == "short" and w is None:
                    e["side"] = "short"

            for _, r in own.iterrows():
                w = float(r["value"]) / pl if pd.notna(r["value"]) else 0.0
                kind, comms, side = _classify(r.to_dict())
                if kind == "futures":
                    futures.append({"label": r["desc"][:60], "side": side, "commodities": comms})
                    for c in comms:
                        add(c, None, "futuros", side)
                    continue
                positions.append({"label": (r["desc"] or r["aplic"])[:70], "type": r["aplic"][:40], "weight": w})
                # Cotas de fundo que publica CDA: usa a carteira dele (look-through de um nível) em vez do nome,
                # para não contar a mesma exposição duas vezes.
                sub = df[df["cnpj"] == r["cota"]] if kind == "fund" and r["cota"] and not df.empty else df.iloc[0:0]
                sub_pl = (mon["pl"].get(r["cota"]) or float(sub["value"].sum() or 0)) if len(sub) else 0.0
                if len(sub) and sub_pl > 0:
                    for _, s in sub.iterrows():
                        k2, c2, side2 = _classify(s.to_dict())
                        if k2 == "futures":
                            for c in c2:
                                add(c, None, "futuros (fundo investido)", side2)
                            continue
                        w2 = w * float(s["value"]) / sub_pl if pd.notna(s["value"]) else 0.0
                        for c in c2:
                            add(c, w2, "fundo investido", side2)
                    continue
                for c in comms:
                    add(c, w, {"stock": "ações", "foreign": "exterior", "fund": "cotas de fundos", "other": "outros ativos"}.get(kind, kind), side)
            positions.sort(key=lambda p: -abs(p["weight"]))
            for e in exposures.values():
                e["weight"] = round(e["weight"], 4) if e["weighted"] else None
            out[cnpj] = {
                "month": f"{mon['month'][:4]}-{mon['month'][4:]}", "pl": pl, "confidentialShare": round(conf_share, 4),
                "top": [{**p, "weight": round(p["weight"], 4)} for p in positions[:12]],
                "futures": futures[:12], "exposures": exposures, "positions": len(positions),
            }
            break
    log.info("CDA: carteira verificada para %d de %d fundos", len(out), len(cnpjs))
    return out
