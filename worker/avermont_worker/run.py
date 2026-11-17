"""CLI do worker Avermont.

Uso:
    python -m avermont_worker.run all            # pipeline completo
    python -m avermont_worker.run prices fx      # etapas específicas
Etapas: prices, fx, macro, companies, funds, demo, forecast, correlations, build
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import traceback
from datetime import date

from . import analytics, forecast
from .config import MARKET_DIR
from .sources import bcb, cvm_companies, cvm_funds, ecb, worldbank
from .store import IngestionLog, load_catalog, now_iso, read_json, read_series, write_json, write_series
from .validate import validate_points

log = logging.getLogger("avermont")

PROVIDERS = {
    "worldbank_pinksheet": {
        "label": "World Bank — Commodity Price Data (The Pink Sheet)",
        "url": "https://www.worldbank.org/en/research/commodity-markets",
        "license": "CC BY 4.0",
        "market": "Preços internacionais de referência (médias mensais)",
        "delay": "Publicação mensal (início do mês seguinte)",
    },
    "bcb_ptax": {
        "label": "Banco Central do Brasil — PTAX",
        "url": "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao",
        "license": "Dados públicos BCB (citar a fonte)",
        "market": "Taxa PTAX de fechamento (venda)",
        "delay": "Diária, após 13h (horário de Brasília)",
    },
    "ecb_cross": {
        "label": "Banco Central Europeu — taxas de referência (cruzamento calculado pela Avermont)",
        "url": "https://data.ecb.europa.eu/",
        "license": "Reutilização permitida com citação da fonte (BCE)",
        "market": "Taxa de referência diária do BCE (~16h CET)",
        "delay": "Diária, dias úteis TARGET",
    },
    "ecb_dxy_replica": {
        "label": "Réplica Avermont do índice do dólar (insumos: taxas de referência do BCE)",
        "url": "https://data.ecb.europa.eu/",
        "license": "Cálculo próprio; insumos BCE. Não é o índice oficial ICE DXY®.",
        "market": "Índice calculado",
        "delay": "Diária",
    },
    "demo": {
        "label": "DEMONSTRAÇÃO — série sintética (não é dado de mercado)",
        "url": None,
        "license": "—",
        "market": "Índice demonstrativo base 100",
        "delay": "—",
    },
}

UNIT_LABEL = {"t": "US$/t", "kg": "US$/kg", "dmt": "US$/t seca", "oz troy": "US$/oz troy", "bbl": "US$/barril", "MMBtu": "US$/MMBtu", "m³": "US$/m³", "índice": "índice (demo)"}


def step_prices(cat: dict, ilog: IngestionLog) -> None:
    real = [i for i in cat["instruments"] if i["provider"] == "worldbank_pinksheet"]
    try:
        data = worldbank.fetch([i["providerSeries"] for i in real])
        rows, latest = 0, None
        for inst in real:
            raw = data.get(inst["providerSeries"])
            if not raw:
                log.warning("sem dados para %s", inst["id"])
                continue
            pts, rep = validate_points(raw["points"])
            rows += len(pts)
            latest = max(latest or pts[-1][0], pts[-1][0])
            write_series(inst["id"], {
                "id": inst["id"], "frequency": "monthly", "unit": inst["unit"], "currency": inst["currency"],
                "sourceUnit": raw["unit"], "provider": "worldbank_pinksheet", "points": pts,
                "validation": rep.as_dict(), "ingestedAt": now_iso(), "sourceNote": data["_meta"].get("sheetNote"),
                "sourceUrl": data["_meta"]["url"],
            })
        ilog.record("worldbank_pinksheet", True, rows=rows, latest_observation=latest)
    except Exception as exc:  # noqa: BLE001
        log.error("World Bank falhou: %s", exc)
        ilog.record("worldbank_pinksheet", False, error=repr(exc)[:500])


def step_fx(cat: dict, ilog: IngestionLog) -> None:
    try:
        usd = ptax_usd = bcb.ptax("USD", years=30)
        eur = bcb.ptax("EUR")
        for sid, pts in (("usdbrl", usd), ("eurbrl", eur)):
            clean, rep = validate_points(pts, max_abs_log_jump=0.15)
            write_series(sid, {"id": sid, "frequency": "daily", "unit": "R$", "currency": "BRL", "provider": "bcb_ptax",
                               "points": clean, "validation": rep.as_dict(), "ingestedAt": now_iso()})
        monthly = analytics.monthly_average(ptax_usd)
        write_series("usdbrl-monthly", {"id": "usdbrl-monthly", "frequency": "monthly", "unit": "R$", "currency": "BRL",
                                        "provider": "bcb_ptax", "points": monthly, "derived": "média mensal da PTAX venda", "ingestedAt": now_iso()})
        ilog.record("bcb_ptax", True, rows=len(usd) + len(eur), latest_observation=usd[-1][0])
    except Exception as exc:  # noqa: BLE001
        log.error("PTAX falhou: %s", exc)
        ilog.record("bcb_ptax", False, error=repr(exc)[:500])
    try:
        rates = ecb.fetch_rates()
        derived = {
            "cnybrl": ecb.cross(rates, "CNY", "BRL"),
            "audusd": ecb.cross(rates, "AUD", "USD"),
            "usdcad": ecb.cross(rates, "USD", "CAD"),
            "usdnok": ecb.cross(rates, "USD", "NOK"),
            "dxy": ecb.dxy_replica(rates),
        }
        n = 0
        for sid, pts in derived.items():
            clean, rep = validate_points(pts, max_abs_log_jump=0.15)
            n += len(clean)
            write_series(sid, {"id": sid, "frequency": "daily", "provider": "ecb_dxy_replica" if sid == "dxy" else "ecb_cross",
                               "points": clean, "validation": rep.as_dict(), "ingestedAt": now_iso()})
        ilog.record("ecb_exr", True, rows=n, latest_observation=derived["audusd"][-1][0])
    except Exception as exc:  # noqa: BLE001
        log.error("BCE falhou: %s", exc)
        ilog.record("ecb_exr", False, error=repr(exc)[:500])


def step_macro(cat: dict, ilog: IngestionLog) -> None:
    out = read_json(MARKET_DIR / "macro.json", {"indicators": {}, "focus": None})
    ok_any = False
    for sid, (code, name, unit, freq) in bcb.SGS_SERIES.items():
        try:
            pts = bcb.sgs(code)
            if not pts:
                raise ValueError("série vazia")
            out["indicators"][sid] = {"id": sid, "sgs": code, "name": name, "unit": unit, "frequency": freq,
                                      "points": pts[-400:] if freq == "daily" else pts, "ingestedAt": now_iso(),
                                      "source": f"BCB SGS série {code}"}
            ilog.record(f"bcb_sgs_{code}", True, rows=len(pts), latest_observation=pts[-1][0])
            ok_any = True
        except Exception as exc:  # noqa: BLE001
            log.error("SGS %s falhou: %s", code, exc)
            ilog.record(f"bcb_sgs_{code}", False, error=repr(exc)[:500])
    try:
        out["focus"] = bcb.focus_annual() | {"ingestedAt": now_iso(), "source": "BCB — Sistema de Expectativas de Mercado (Focus)"}
        ilog.record("bcb_focus", True, rows=len(out["focus"]["items"]), latest_observation=out["focus"]["date"])
        ok_any = True
    except Exception as exc:  # noqa: BLE001
        log.error("Focus falhou: %s", exc)
        ilog.record("bcb_focus", False, error=repr(exc)[:500])
    if ok_any:
        write_json(MARKET_DIR / "macro.json", out)


def step_companies(cat: dict, ilog: IngestionLog) -> None:
    try:
        data = cvm_companies.fetch()
        data["ingestedAt"] = now_iso()
        write_json(MARKET_DIR / "companies.json", data)
        mism = [c for c in data["companies"] if c["tickersMismatch"]]
        ilog.record("cvm_companies", True, rows=len(data["companies"]),
                    error=("tickers não confirmados no FCA: " + ", ".join(t for c in mism for t in c["tickersMismatch"])) if mism else None)
    except Exception as exc:  # noqa: BLE001
        log.error("CVM companhias falhou: %s\n%s", exc, traceback.format_exc())
        ilog.record("cvm_companies", False, error=repr(exc)[:500])


def step_funds(cat: dict, ilog: IngestionLog) -> None:
    try:
        data = cvm_funds.fetch()
        data["ingestedAt"] = now_iso()
        write_json(MARKET_DIR / "funds.json", data)
        latest = max((f["performance"]["quotaDate"] for f in data["funds"] if f.get("performance")), default=None)
        ilog.record("cvm_funds", True, rows=len(data["funds"]), latest_observation=latest)
    except Exception as exc:  # noqa: BLE001
        log.error("CVM fundos falhou: %s\n%s", exc, traceback.format_exc())
        ilog.record("cvm_funds", False, error=repr(exc)[:500])


def step_demo(cat: dict, ilog: IngestionLog) -> None:
    for inst in cat["instruments"]:
        if inst["dataMode"] == "demo":
            write_series(inst["id"], {"id": inst["id"], "frequency": "monthly", "unit": "índice", "currency": "IDX",
                                      "provider": "demo", "demo": True, "points": analytics.demo_series(inst["id"]),
                                      "ingestedAt": now_iso(),
                                      "warning": "SÉRIE DEMONSTRATIVA — valores sintéticos, não representam preços de mercado."})
    ilog.record("demo", True)


def _forecast_targets(cat: dict) -> list[tuple[str, str]]:
    t = [(i["id"], "monthly") for i in cat["instruments"] if i["dataMode"] == "real"]
    t += [(c["id"], "daily") for c in cat["currencies"] if c["dataMode"] == "real"]
    return t


def step_forecast(cat: dict, ilog: IngestionLog) -> None:
    results = {}
    for sid, freq in _forecast_targets(cat):
        s = read_series(sid)
        if not s or not s.get("points"):
            continue
        pts = s["points"]
        if freq == "daily":
            pts = pts[-2600:]
        try:
            res = forecast.forecast_series(forecast.SeriesInput(sid, freq, [p[0] for p in pts], [p[1] for p in pts]))
            results[sid] = res
            log.info("forecast %s ok", sid)
        except Exception as exc:  # noqa: BLE001
            log.error("forecast %s falhou: %s\n%s", sid, exc, traceback.format_exc())
    payload = {"generatedAt": now_iso(), "engineVersion": "1.0.0", "forecasts": results}
    write_json(MARKET_DIR / "forecasts.json", payload)
    # Arquivo imutável (append-only) para auditoria do histórico de previsões
    body = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    digest = hashlib.sha256(body).hexdigest()
    arch = MARKET_DIR / "forecast_archive" / f"{date.today().isoformat()}_{digest[:12]}.json"
    if not arch.exists():
        write_json(arch, payload | {"sha256": digest})
    index = read_json(MARKET_DIR / "forecast_archive" / "index.json", {"entries": []})
    if digest not in [e["sha256"] for e in index["entries"]]:
        index["entries"].append({"file": arch.name, "sha256": digest, "generatedAt": payload["generatedAt"], "series": len(results)})
        write_json(MARKET_DIR / "forecast_archive" / "index.json", index)
    ilog.record("forecast_engine", True, rows=len(results))


def step_correlations(cat: dict, ilog: IngestionLog) -> None:
    monthly = {}
    for i in cat["instruments"]:
        if i["dataMode"] == "real":
            s = read_series(i["id"])
            if s:
                monthly[i["id"]] = s["points"]
    for c in cat["currencies"]:
        if c["dataMode"] == "real":
            s = read_series(c["id"])
            if s:
                monthly[c["id"]] = analytics.monthly_average(s["points"])
    corr = analytics.correlations(monthly, window=120)
    corr["generatedAt"] = now_iso()
    corr["method"] = "Pearson sobre retornos logarítmicos mensais (médias mensais); IC 95% por transformação de Fisher; estabilidade por janela móvel de 36 meses."
    write_json(MARKET_DIR / "correlations.json", corr)
    ilog.record("correlations", True, rows=len(corr["pairs"]))


def step_build(cat: dict, ilog: IngestionLog) -> None:
    fc = read_json(MARKET_DIR / "forecasts.json", {"forecasts": {}})["forecasts"]
    usd_m = read_series("usdbrl-monthly")
    usd_map = {p[0]: p[1] for p in usd_m["points"]} if usd_m else {}
    items = []
    entries = [(i, "instrument") for i in cat["instruments"]] + [(c, "currency") for c in cat["currencies"]]
    for inst, kind in entries:
        s = read_series(inst["id"])
        base = {
            "id": inst["id"], "name": inst["name"], "type": kind,
            "category": inst.get("category", "moedas"), "dataMode": inst["dataMode"], "provider": inst["provider"],
        }
        if not s or not s.get("points"):
            items.append(base | {"stats": {"status": "no_data"}})
            continue
        freq = s["frequency"]
        stats = analytics.summarize(s["points"], freq)
        f30 = fc.get(inst["id"], {}).get("horizons", {}).get("30d", {})
        prov = PROVIDERS.get(s["provider"], {})
        record = base | {
            "frequency": freq,
            "unit": inst.get("unit") or s.get("unit"),
            "currency": inst.get("currency") or s.get("currency"),
            "unitLabel": UNIT_LABEL.get(inst.get("unit"), inst.get("unitLabel")),
            "source": {"provider": s["provider"], "label": prov.get("label"), "url": prov.get("url"), "license": prov.get("license"),
                       "market": prov.get("market"), "delay": prov.get("delay"), "ingestedAt": s.get("ingestedAt")},
            "stats": stats,
            "forecast30d": {"status": f30.get("status"), "direction": f30.get("direction"), "expectedChange": f30.get("expectedChange"),
                            "beatsBaseline": f30.get("beatsBaseline")} if f30 else None,
        }
        items.append(record)
        # Série convertida em reais (preço internacional × PTAX média do mês) — não é preço físico no Brasil
        if kind == "instrument" and inst["dataMode"] == "real" and usd_map:
            brl = [[d, round(v * usd_map[d], 6)] for d, v in s["points"] if d in usd_map]
            if brl:
                s["brlPoints"] = brl
                s["brlNote"] = "Preço internacional em US$ convertido pela média mensal da PTAX (venda). Não é preço físico no Brasil."
                write_series(inst["id"], s)
    write_json(MARKET_DIR / "summary.json", {"generatedAt": now_iso(), "items": items})
    ilog.record("build", True, rows=len(items))


STEPS = {
    "prices": step_prices, "fx": step_fx, "macro": step_macro, "companies": step_companies, "funds": step_funds,
    "demo": step_demo, "forecast": step_forecast, "correlations": step_correlations, "build": step_build,
}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Avermont data worker")
    ap.add_argument("steps", nargs="+", help="all | " + " | ".join(STEPS))
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    steps = list(STEPS) if "all" in args.steps else args.steps
    cat = load_catalog()
    ilog = IngestionLog()
    for st in steps:
        if st not in STEPS:
            log.error("etapa desconhecida: %s", st)
            return 2
        log.info("== etapa %s", st)
        STEPS[st](cat, ilog)
        ilog.save()
    failed = [k for k, v in ilog.data["runs"].items() if not v["ok"]]
    if failed:
        log.warning("fontes com falha: %s", ", ".join(failed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
