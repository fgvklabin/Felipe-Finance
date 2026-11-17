"""Banco Central do Brasil — PTAX (Olinda), SGS e Boletim Focus (Olinda Expectativas).

Dados públicos do BCB; reprodução permitida com citação da fonte.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from urllib.parse import quote

from ..config import BCB_OLINDA_FOCUS, BCB_OLINDA_PTAX, BCB_SGS_URL, DAILY_HISTORY_YEARS
from ..net import get_json

log = logging.getLogger("avermont.bcb")

SGS_SERIES = {
    # id interno: (código SGS, nome, unidade, frequência)
    "selic-meta": (432, "Taxa Selic — meta (Copom)", "% a.a.", "daily"),
    "ipca-12m": (13522, "IPCA — acumulado em 12 meses", "%", "monthly"),
    "ipca-mensal": (433, "IPCA — variação mensal", "%", "monthly"),
    "ibc-br": (24364, "IBC-Br dessazonalizado (prévia do PIB)", "índice", "monthly"),
}


def _fmt_olinda(d: date) -> str:
    return d.strftime("%m-%d-%Y")


def ptax(currency: str, years: int = DAILY_HISTORY_YEARS) -> list[tuple[str, float]]:
    """Cotação PTAX de fechamento (venda) em R$ por unidade da moeda."""
    end = date.today()
    start = end - timedelta(days=int(365.25 * years))
    if currency == "USD":
        url = (
            f"{BCB_OLINDA_PTAX}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
            f"?@dataInicial='{_fmt_olinda(start)}'&@dataFinalCotacao='{_fmt_olinda(end)}'"
            "&$format=json&$select=cotacaoVenda,dataHoraCotacao&$top=100000"
        )
    else:
        url = (
            f"{BCB_OLINDA_PTAX}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
            f"?@moeda='{currency}'&@dataInicial='{_fmt_olinda(start)}'&@dataFinalCotacao='{_fmt_olinda(end)}'"
            "&$format=json&$filter=" + quote("tipoBoletim eq 'Fechamento'") + "&$select=cotacaoVenda,dataHoraCotacao&$top=100000"
        )
    data = get_json(url, timeout=120)["value"]
    out: dict[str, float] = {}
    for row in data:
        out[row["dataHoraCotacao"][:10]] = float(row["cotacaoVenda"])  # último boletim do dia prevalece
    return sorted(out.items())


def sgs(code: int, years: int = DAILY_HISTORY_YEARS) -> list[tuple[str, float]]:
    """Série do SGS. O SGS limita consultas diárias a 10 anos por requisição."""
    end = date.today()
    start = end - timedelta(days=int(365.25 * min(years, 10)) - 1)
    url = BCB_SGS_URL.format(code=code)
    data = get_json(url, params={"formato": "json", "dataInicial": start.strftime("%d/%m/%Y"), "dataFinal": end.strftime("%d/%m/%Y")})
    out = []
    for row in data:
        d, m, y = row["data"].split("/")
        try:
            out.append((f"{y}-{m}-{d}", float(row["valor"])))
        except ValueError:
            continue
    # O SGS 432 publica a meta vigente até a próxima reunião (datas futuras); mantemos só até hoje.
    today = date.today().isoformat()
    return [p for p in out if p[0] <= today]


def focus_annual() -> dict:
    """Mediana das expectativas anuais (Boletim Focus) na data mais recente disponível."""
    base = f"{BCB_OLINDA_FOCUS}/ExpectativasMercadoAnuais"

    def odata(params: dict) -> list[dict]:
        # A API Olinda exige espaços como %20 (não '+'), por isso a query é montada manualmente.
        qs = "&".join(k + "=" + quote(v, safe="',") for k, v in params.items())
        return get_json(f"{base}?{qs}")["value"]

    latest = odata({"$top": "1", "$orderby": "Data desc", "$format": "json", "$select": "Data"})[0]["Data"]
    rows = odata({"$filter": f"Data eq '{latest}' and baseCalculo eq 0", "$format": "json", "$top": "1000",
                  "$select": "Indicador,IndicadorDetalhe,DataReferencia,Mediana,Media,DesvioPadrao,Minimo,Maximo,numeroRespondentes"})
    wanted = {"IPCA", "Selic", "Câmbio", "PIB Total"}
    items = [r for r in rows if r["Indicador"] in wanted and not r.get("IndicadorDetalhe")]
    return {"date": latest, "items": items}
