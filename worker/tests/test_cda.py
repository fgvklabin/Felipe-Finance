import pytest

from avermont_worker.sources import cvm_cda
from avermont_worker.sources.cvm_cda import FUTURES, _classify


def row(**kw):
    base = {"block": "BLC_8", "aplic": "", "ativo": "", "desc": "", "value": 0.0, "cota": None, "pais": None}
    return base | kw


def test_futures_direction_without_weight():
    kind, comms, side = _classify(row(aplic="Mercado Futuro - Posições vendidas", desc="GLDFZ26"))
    assert (kind, comms, side) == ("futures", ["ouro"], "short")
    assert _classify(row(aplic="Mercado Futuro - Posições compradas", desc="FUT DI1"))[1] == []


def test_stocks_map_to_commodities():
    assert _classify(row(block="BLC_4", aplic="Ações", desc="VALE3 VALE ON"))[1] == ["minerio-ferro", "niquel", "cobre"]
    assert _classify(row(block="BLC_4", aplic="Ações", desc="ITUB4 ITAU PN"))[1] == []


def test_foreign_assets_carry_dollar_exposure():
    kind, comms, _ = _classify(row(block="BLC_7", aplic="Investimento no Exterior", desc="IAU ISHARES GOLD TRUST", pais="Estados Unidos"))
    assert kind == "foreign" and comms == ["ouro", "usdbrl"]


def test_fund_shares_use_name_keywords():
    assert _classify(row(block="BLC_2", aplic="Cotas de Fundos", desc="B-INDEX ETF OURO BRL B3"))[1] == ["ouro"]
    assert _classify(row(block="BLC_2", aplic="Cotas de Fundos", desc="CAFÉ VELHO FII"))[1] == []


def test_regex_does_not_confuse_unrelated_codes():
    hits = lambda s: [c for rx, c in FUTURES if rx.search(s)]  # noqa: E731
    assert hits("FUT ISP/Z26") == [] and hits("FUT WIN") == []
    assert hits("WDOFX26") == ["usdbrl"] and hits("ICFZ26") == ["cafe-arabica"]


def test_look_through_does_not_double_count(monkeypatch):
    import pandas as pd
    a, b = "1" * 14, "2" * 14
    rows = pd.DataFrame([
        {"cnpj": a, "block": "BLC_2", "aplic": "Cotas de Fundos", "ativo": "", "desc": "FUNDO OURO FIM", "value": 90.0, "cota": b, "pais": None},
        {"cnpj": a, "block": "BLC_1", "aplic": "Títulos Públicos", "ativo": "", "desc": "LFT", "value": 10.0, "cota": None, "pais": None},
        {"cnpj": b, "block": "BLC_7", "aplic": "Investimento no Exterior", "ativo": "", "desc": "IAU", "value": 50.0, "cota": None, "pais": "Estados Unidos"},
        {"cnpj": b, "block": "BLC_1", "aplic": "Títulos Públicos", "ativo": "", "desc": "LFT", "value": 50.0, "cota": None, "pais": None},
    ])
    monkeypatch.setattr(cvm_cda, "_load_month", lambda ym, cnpjs: {"month": "202610", "rows": rows, "pl": {a: 100.0, b: 100.0}, "conf": {}})
    out = cvm_cda.holdings({a}, months=1)[a]
    # 90% em cotas de um fundo que tem 50% em ouro → 45%, não 90% (nome) + 45% (carteira)
    assert out["exposures"]["ouro"]["weight"] == pytest.approx(0.45)
    assert out["exposures"]["ouro"]["via"] == ["fundo investido"]
