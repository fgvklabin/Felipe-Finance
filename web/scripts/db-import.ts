/**
 * Importa os snapshots do worker (web/data) para o PostgreSQL (DATABASE_URL) ou PGlite local.
 *   npm run db:import
 * Regras: inserções idempotentes; preços históricos são APPEND-ONLY — se a fonte revisar um valor já
 * importado, registramos uma linha de correção (supersedes_id + correction_reason), nunca um UPDATE.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb, query, one } from "../src/lib/db";
import { SOURCES } from "../src/lib/sources-registry";
import { COMPANY_KB } from "../src/lib/companies-kb";

const DATA = path.join(process.cwd(), "data");
const read = <T,>(rel: string): T => JSON.parse(fs.readFileSync(path.join(DATA, rel), "utf-8"));
const SOURCE_OF: Record<string, string> = { worldbank_pinksheet: "worldbank_pinksheet", bcb_ptax: "bcb_ptax", ecb_cross: "ecb_exr", ecb_dxy_replica: "ecb_exr", demo: "demo" };

async function main() {
  await getDb();
  const t0 = Date.now();
  // Fontes
  for (const s of [...SOURCES, { id: "demo", provider: "Avermont (demonstração)", category: "Demonstração", api: "—", auth: "—", frequency: "—", geo: "—", history: "—", currency: "—", unit: "índice", licensing: "demo", licenseNote: "Série sintética", integration: "integrated", quality: "Sintética", limitations: "Não representa preços reais", url: "" }]) {
    await query(
      `INSERT INTO data_sources (id, provider, category, api_available, auth_required, update_frequency, coverage_geo, coverage_history, currency, unit, licensing_status, license, integration_status, data_quality, limitations, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET licensing_status = EXCLUDED.licensing_status, integration_status = EXCLUDED.integration_status, limitations = EXCLUDED.limitations`,
      [s.id, s.provider, s.category, !/sem api/i.test(s.api), !/nenhuma|—/i.test(s.auth), s.frequency, s.geo, s.history, s.currency, s.unit, s.licensing, s.licenseNote, s.integration, s.quality, s.limitations, s.url || null],
    );
  }
  const log = read<{ runs: Record<string, { lastSuccess: string | null }> }>("market/ingestion_log.json").runs;
  for (const [k, v] of Object.entries(log)) if (v.lastSuccess) await query("UPDATE data_sources SET last_success_at = $2 WHERE id = $1", [k === "ecb_exr" ? "ecb_exr" : k.startsWith("bcb_sgs") ? "bcb_sgs" : k, v.lastSuccess]);

  // Catálogo
  const cat = read<{ categories: { id: string; name: { pt: string; en: string }; color: string }[]; instruments: { id: string; category: string; name: { pt: string; en: string }; kind: string; priceType: string; dataMode: string; provider: string; unit: string; currency: string; frequency: string; benchmark: string }[] }>("catalog/instruments.json");
  for (const c of cat.categories) await query("INSERT INTO commodity_categories (id, name_pt, name_en, color) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, color = EXCLUDED.color", [c.id, c.name.pt, c.name.en, c.color]);
  for (const i of cat.instruments) {
    await query(
      `INSERT INTO commodities (id, category_id, name_pt, name_en, kind, price_type, data_mode, source_id, unit, currency, frequency, benchmark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET data_mode = EXCLUDED.data_mode, benchmark = EXCLUDED.benchmark`,
      [i.id, i.category, i.name.pt, i.name.en, i.kind, i.priceType, i.dataMode, SOURCE_OF[i.provider] ?? null, i.unit, i.currency, i.frequency, i.benchmark],
    );
  }

  // Preços históricos (append-only com detecção de revisões)
  let inserted = 0, revisions = 0;
  for (const i of cat.instruments) {
    const f = path.join(DATA, "market", "series", `${i.id}.json`);
    if (!fs.existsSync(f)) continue;
    const s = JSON.parse(fs.readFileSync(f, "utf-8")) as { provider: string; points: [string, number][] };
    const src = SOURCE_OF[s.provider] ?? "demo";
    const existing = new Map((await query<{ id: number; observed_at: string; value: number }>("SELECT id, observed_at, value FROM effective_prices WHERE commodity_id = $1 AND source_id = $2", [i.id, src])).map((r) => [r.observed_at, r]));
    for (const [d, v] of s.points) {
      const e = existing.get(d);
      if (!e) {
        await query("INSERT INTO historical_prices (commodity_id, source_id, observed_at, value, currency, unit, is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING", [i.id, src, d, v, i.currency, i.unit, i.dataMode === "demo"]);
        inserted++;
      } else if (Math.abs(e.value - v) > 1e-9 * Math.max(1, Math.abs(v))) {
        await query("INSERT INTO historical_prices (commodity_id, source_id, observed_at, value, currency, unit, is_demo, supersedes_id, correction_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'revisão publicada pela fonte')", [i.id, src, d, v, i.currency, i.unit, i.dataMode === "demo", e.id]);
        revisions++;
      }
    }
  }
  // Câmbio
  for (const pair of ["usdbrl", "eurbrl", "cnybrl", "audusd", "usdcad", "usdnok", "dxy"]) {
    const f = path.join(DATA, "market", "series", `${pair}.json`);
    if (!fs.existsSync(f)) continue;
    const s = JSON.parse(fs.readFileSync(f, "utf-8")) as { provider: string; points: [string, number][] };
    for (const [d, v] of s.points) await query("INSERT INTO currency_prices (pair, source_id, observed_at, value, derived) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [pair, SOURCE_OF[s.provider] ?? "ecb_exr", d, v, s.provider !== "bcb_ptax"]);
  }
  // Macro e Focus
  const macro = read<{ indicators: Record<string, { id: string; name: string; unit: string; frequency: string; sgs: number; points: [string, number][] }>; focus: { date: string; items: { Indicador: string; DataReferencia: string; Mediana: number; Media: number; DesvioPadrao: number; Minimo: number; Maximo: number; numeroRespondentes: number }[] } | null }>("market/macro.json");
  for (const ind of Object.values(macro.indicators)) {
    await query("INSERT INTO economic_indicators (id, name, unit, frequency, source_id, source_code) VALUES ($1,$2,$3,$4,'bcb_sgs',$5) ON CONFLICT (id) DO NOTHING", [ind.id, ind.name, ind.unit, ind.frequency, String(ind.sgs)]);
    for (const [d, v] of ind.points) await query("INSERT INTO economic_indicator_values (indicator_id, observed_at, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [ind.id, d, v]);
  }
  for (const it of macro.focus?.items ?? []) {
    await query("INSERT INTO market_expectations (source, survey_date, indicator, reference_period, median, mean, stdev, min, max, respondents) VALUES ('bcb_focus',$1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      [macro.focus!.date, it.Indicador, it.DataReferencia, it.Mediana, it.Media, it.DesvioPadrao, it.Minimo, it.Maximo, it.numeroRespondentes]);
  }
  // Companhias
  const cos = read<{ companies: { cnpj: string; name: string; cvmCode: string; sector: string; activityDescription: string; website: string; registrationStatus: string; fcaReferenceDate: string; tickersGiven: string[]; tickersVerified: string[]; securities: { code: string; security: string; segment: string }[]; financials: { fiscalYear: number; fiscalYearEnd: string }[] }[] }>("market/companies.json");
  for (const c of cos.companies) {
    await query("INSERT INTO listed_companies (cnpj, name, cvm_code, sector, activity_description, website, registration_status, fca_reference_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (cnpj) DO UPDATE SET registration_status = EXCLUDED.registration_status, updated_at = now()",
      [c.cnpj, c.name, c.cvmCode, c.sector, c.activityDescription, c.website, c.registrationStatus, c.fcaReferenceDate]);
    for (const t of c.tickersGiven) {
      const sec = c.securities.find((x) => x.code === t);
      await query("INSERT INTO stocks (ticker, company_cnpj, security_type, segment, verified_in_fca) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (ticker) DO UPDATE SET verified_in_fca = EXCLUDED.verified_in_fca, updated_at = now()", [t, c.cnpj, sec?.security ?? null, sec?.segment ?? null, c.tickersVerified.includes(t)]);
    }
    for (const f of c.financials) await query("INSERT INTO company_financial_statements (company_cnpj, fiscal_year, fiscal_year_end, statement, source) VALUES ($1,$2,$3,$4,'cvm_dfp_con') ON CONFLICT DO NOTHING", [c.cnpj, f.fiscalYear, f.fiscalYearEnd, JSON.stringify(f)]);
    const kb = COMPANY_KB.find((k) => k.tickers.some((t) => c.tickersGiven.includes(t)));
    for (const e of kb?.commodityExposure ?? []) {
      await query("INSERT INTO company_commodity_exposures (company_cnpj, commodity_id, direction, channel, explanation, counterfactors, basis) VALUES ($1,$2,$3,$4,$5,$6,'análise qualitativa Avermont') ON CONFLICT DO NOTHING",
        [c.cnpj, e.commodity, e.direction === "receita" ? "positive" : e.direction === "custo" ? "negative" : "mixed", e.direction, e.note, kb!.offsets.join("; ")]);
    }
  }
  // Fundos
  const funds = read<{ funds: { cnpj: string; name: string; vehicle: string; classification: string | null; manager: string | null; administrator: string | null; netAssets: number; netAssetsDate: string | null; tags: string[]; exposureType: string; exposureBasis: string; performance: unknown; documents: unknown }[] }>("market/funds.json");
  for (const f of funds.funds) {
    await query(
      `INSERT INTO investment_funds (cnpj, name, vehicle, classification, manager, administrator, net_assets, net_assets_date, tags, exposure_type, exposure_basis, performance, documents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (cnpj) DO UPDATE SET net_assets = EXCLUDED.net_assets, performance = EXCLUDED.performance, documents = EXCLUDED.documents, tags = EXCLUDED.tags, exposure_type = EXCLUDED.exposure_type, updated_at = now()`,
      [f.cnpj, f.name, f.vehicle, f.classification, f.manager, f.administrator, f.netAssets, f.netAssetsDate, f.tags, f.exposureType, f.exposureBasis, JSON.stringify(f.performance), JSON.stringify(f.documents)],
    );
  }
  // Previsões (append-only por execução)
  const fc = read<{ generatedAt: string; engineVersion: string; forecasts: Record<string, { id: string; generatedAt: string; origin: { date: string; value: number }; horizons: Record<string, { status: string; targetDate?: string; central?: number; low?: number; high?: number; intervalLevel?: number; model?: string; evaluation?: { model: { n: number; mape: number; mae: number; rmse: number; directionalAccuracy: number | null } | null; intervalCoverage: number | null }; skillVsNaive?: number; dieboldMarianoP?: number | null }> }> }>("market/forecasts.json");
  const idx = fs.existsSync(path.join(DATA, "market/forecast_archive/index.json")) ? read<{ entries: { sha256: string; generatedAt: string }[] }>("market/forecast_archive/index.json").entries.at(-1)?.sha256 : null;
  let fcRows = 0;
  for (const f of Object.values(fc.forecasts)) {
    for (const [h, x] of Object.entries(f.horizons)) {
      const r = await query(
        `INSERT INTO forecast_results (commodity_id, model_id, engine_version, generated_at, origin_date, origin_value, horizon, target_date, status, central, low, high, interval_level, details, archive_sha256)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING RETURNING id`,
        [f.id, x.model ?? "naive", fc.engineVersion, f.generatedAt, f.origin.date, f.origin.value, h, x.targetDate ?? null, x.status, x.central ?? null, x.low ?? null, x.high ?? null, x.intervalLevel ?? null, JSON.stringify(x), idx],
      );
      if (r.length && x.evaluation?.model) {
        const m = x.evaluation.model;
        await query("INSERT INTO forecast_evaluations (commodity_id, horizon, model_id, window_kind, n, mape, mae, rmse, directional_accuracy, interval_coverage, skill_vs_naive, dm_p_value) VALUES ($1,$2,$3,'backtest',$4,$5,$6,$7,$8,$9,$10,$11)",
          [f.id, h, x.model ?? "naive", m.n, m.mape, m.mae, m.rmse, m.directionalAccuracy, x.evaluation.intervalCoverage, x.skillVsNaive ?? null, x.dieboldMarianoP ?? null]);
      }
      fcRows += r.length;
    }
  }
  const total = await one<{ n: number }>("SELECT count(*)::int AS n FROM historical_prices");
  console.log(JSON.stringify({ seconds: (Date.now() - t0) / 1000, pricesInserted: inserted, priceRevisions: revisions, pricesTotal: total?.n, forecastRows: fcRows, companies: cos.companies.length, funds: funds.funds.length }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
