import pytest

from avermont_worker.sources.cvm_itr import build_quarters, period_label

C = "00.000.000/0001-00"


def dre(refer, ini, fim, conta, val, versao=1):
    return {"CNPJ_CIA": C, "DT_REFER": refer, "VERSAO": str(versao), "DT_INI_EXERC": ini, "DT_FIM_EXERC": fim, "CD_CONTA": conta, "VL_CONTA": str(val), "ESCALA_MOEDA": "UNIDADE", "DS_CONTA": "x"}


def da(refer, ini, fim, val):
    return dre(refer, ini, fim, "6.01.01.04", -val) | {"DS_CONTA": "Depreciação e amortização"}


def test_calendar_year_quarters_and_q4_from_annual():
    rows = [
        dre("2025-03-31", "2025-01-01", "2025-03-31", "3.01", 100),
        dre("2025-06-30", "2025-04-01", "2025-06-30", "3.01", 110),
        dre("2025-06-30", "2025-01-01", "2025-06-30", "3.01", 210),
        dre("2025-09-30", "2025-07-01", "2025-09-30", "3.01", 90),
        dre("2025-09-30", "2025-01-01", "2025-09-30", "3.01", 300),
    ]
    dfc = [da("2025-03-31", "2025-01-01", "2025-03-31", 10), da("2025-06-30", "2025-01-01", "2025-06-30", 22), da("2025-09-30", "2025-01-01", "2025-09-30", 33)]
    annual = {C: [{"fiscalYearEnd": "2025-12-31", "revenue": 420.0, "depreciationAmortization": 45.0, "debtCurrent": 50.0, "cash": 20.0}]}
    q = build_quarters(rows, dfc, [], annual, {C})[C]
    assert [x["period"] for x in q] == ["2025T1", "2025T2", "2025T3", "2025T4"]
    assert [x["revenue"] for x in q] == [100, 110, 90, 120]  # 4º tri = 420 − 300
    assert q[3]["source"].startswith("DFP")
    assert [x["depreciationAmortization"] for x in q] == [10, 12, 11, 12]
    assert q[3]["netDebt"] == pytest.approx(30.0)


def test_restated_value_from_newer_document_wins():
    rows = [
        dre("2025-03-31", "2025-01-01", "2025-03-31", "3.01", 100),
        dre("2026-03-31", "2025-01-01", "2025-03-31", "3.01", 95),  # comparativo reapresentado no ITR de 2026
        dre("2026-03-31", "2026-01-01", "2026-03-31", "3.01", 114),
    ]
    q = {x["period"]: x for x in build_quarters(rows, [], [], {}, {C})[C]}
    assert q["2025T1"]["revenue"] == 95
    assert q["2026T1"]["revenueYoY"] == pytest.approx(114 / 95 - 1)


def test_fiscal_year_ending_in_march():
    # ano-safra abril–março: 1º tri do exercício termina em junho
    rows = [
        dre("2025-06-30", "2025-04-01", "2025-06-30", "3.01", 50),
        dre("2025-09-30", "2025-07-01", "2025-09-30", "3.01", 60),
        dre("2025-09-30", "2025-04-01", "2025-09-30", "3.01", 110),
        dre("2025-12-31", "2025-10-01", "2025-12-31", "3.01", 70),
        dre("2025-12-31", "2025-04-01", "2025-12-31", "3.01", 180),
    ]
    dfc = [da("2025-06-30", "2025-04-01", "2025-06-30", 5), da("2025-09-30", "2025-04-01", "2025-09-30", 11), da("2025-12-31", "2025-04-01", "2025-12-31", 18)]
    annual = {C: [{"fiscalYearEnd": "2026-03-31", "revenue": 250.0, "depreciationAmortization": 26.0}]}
    q = build_quarters(rows, dfc, [], annual, {C})[C]
    assert [(x["period"], x["revenue"]) for x in q] == [("2025T2", 50), ("2025T3", 60), ("2025T4", 70), ("2026T1", 70)]
    assert [x["depreciationAmortization"] for x in q] == [5, 6, 7, 8]


def test_period_label():
    assert period_label("2026-09-30") == "2026T3"
    assert period_label("2026-12-31") == "2026T4"
