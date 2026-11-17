import "server-only";
import fs from "node:fs";
import path from "node:path";

// Camada de leitura dos snapshots produzidos pelo worker Python (web/data/market).
// Os arquivos são versionados e somente-leitura em runtime; mudanças chegam por nova ingestão.

const DATA_DIR = process.env.AVERMONT_DATA_DIR ?? path.join(process.cwd(), "data");

export type DataMode = "real" | "demo" | "unavailable";
export type L10n = { pt: string; en: string };

export interface Category { id: string; name: L10n; color: string }

export interface Fundamentals {
  producers: string[]; consumers: string[]; drivers: string[];
  seasonality: string; weather: string; logistics: string; geopolitics: string;
}

export interface CatalogInstrument {
  id: string; name: L10n; category: string; kind: "raw" | "processed";
  priceType: "international_benchmark" | "regional_physical" | "futures" | "index";
  dataMode: DataMode; provider: string; providerSeries: string | null;
  unit: string; currency: string; frequency: "monthly" | "daily";
  benchmark: string; conversions: { label: string; factor: number }[]; brazilRef: string;
  fundamentals: Fundamentals; related: { companies: string[]; currencies: string[] };
}

export interface CatalogCurrency {
  id: string; name: L10n; pair: string; dataMode: DataMode; provider: string;
  unitLabel: string; description: string; commodityLink: string;
}

export interface Catalog { categories: Category[]; instruments: CatalogInstrument[]; currencies: CatalogCurrency[] }

export interface Stats {
  status?: "no_data"; last: number; lastDate: string;
  changes: { d1: number | null; w1: number | null; m1: number | null; m3: number | null; y1: number | null; ytd: number | null };
  volatility: number | null; high52w: number; low52w: number; spark: number[];
  firstDate: string; observations: number; ageDays: number; stale: boolean;
}

export interface SourceInfo {
  provider: string; label: string | null; url: string | null; license: string | null;
  market: string | null; delay: string | null; ingestedAt: string | null;
}

export interface SummaryItem {
  id: string; name: L10n; type: "instrument" | "currency"; category: string; dataMode: DataMode; provider: string;
  frequency?: "monthly" | "daily"; unit?: string; currency?: string; unitLabel?: string;
  source?: SourceInfo; stats: Stats;
  forecast30d: { status?: string; direction?: "up" | "down" | "neutral"; expectedChange?: number; beatsBaseline?: boolean } | null;
}

export interface Series {
  id: string; frequency: "monthly" | "daily"; unit?: string; currency?: string; provider: string;
  points: [string, number][]; brlPoints?: [string, number][]; brlNote?: string; demo?: boolean; warning?: string;
  validation?: { dropped: number; warnings: string[] }; ingestedAt?: string; sourceNote?: string; sourceUrl?: string;
}

export interface HorizonForecast {
  status: "ok" | "insufficient_data" | "frequency_mismatch" | "not_justified" | "expired";
  message?: string; reason?: string; steps?: number; targetDate?: string;
  central?: number; low?: number; high?: number; bullish?: number; bearish?: number;
  expectedChange?: number; intervalLevel?: number; direction?: "up" | "down" | "neutral";
  model?: string; modelLabel?: string; selectedByValidation?: string; fallbackNote?: string | null;
  skillVsNaive?: number; candidateSkill?: number; dieboldMarianoP?: number | null; beatsBaseline?: boolean; intervalWarning?: string | null;
  evaluation?: {
    selectionOrigins: number; evaluationOrigins: number; intervalCoverage: number | null;
    model: Metrics | null; naive: Metrics | null; selectionScores: Record<string, number>;
  };
}
export interface Metrics { n: number; mape: number; maeLog: number; rmseLog: number; mae: number; rmse: number; directionalAccuracy: number | null; directionalN: number }

export interface ForecastResult {
  id: string; frequency: string; generatedAt: string; origin: { date: string; value: number }; observations: number;
  horizons: Record<string, HorizonForecast>;
  method: { candidates?: string[]; window?: number; validation?: string; interval?: string; originsStride?: number };
  signals: { momentum3?: number; momentum12?: number | null; volRecent?: number; volLongRun?: number; seasonality?: { month: number; meanReturn: number; std: number; n: number }[] };
}

export interface IngestionRun { source: string; lastAttempt: string; ok: boolean; rows: number; error: string | null; latestObservation: string | null; lastSuccess: string | null; consecutiveFailures: number }

export interface FocusItem { Indicador: string; DataReferencia: string; Mediana: number; Media: number; DesvioPadrao: number; Minimo: number; Maximo: number; numeroRespondentes: number }
export interface Macro {
  indicators: Record<string, { id: string; sgs: number; name: string; unit: string; frequency: string; points: [string, number][]; ingestedAt: string; source: string }>;
  focus: { date: string; items: FocusItem[]; ingestedAt: string; source: string } | null;
}

export interface CompanyYear {
  fiscalYear: number; fiscalYearEnd: string; currency?: string; revenue?: number; grossProfit?: number; ebit?: number; financialResult?: number;
  netIncome?: number; totalAssets?: number; cash?: number; shortTermInvestments?: number; debtCurrent?: number; debtNonCurrent?: number;
  equity?: number; depreciationAmortization?: number; ebitdaCalculated?: number; grossDebt?: number; netDebt?: number;
  grossProfitMargin?: number; ebitMargin?: number; netIncomeMargin?: number; ebitdaCalculatedMargin?: number;
}
export interface CvmCompany {
  cnpj: string; tickersGiven: string[]; tickersVerified: string[]; tickersMismatch: string[];
  securities: { code: string; security: string; segment: string; composition: string | null }[];
  name: string | null; cvmCode: string | null; registrationStatus: string; issuerStatus: string | null; sector: string | null;
  activityDescription: string | null; control: string | null; website: string | null; fcaReferenceDate: string | null; financials: CompanyYear[];
}

export interface Fund {
  cnpj: string; cnpjDigits: string; name: string; vehicle: "etf" | "fiagro" | "multimercado" | "acoes" | "cambial";
  classType: string; classification: string | null; anbimaClassification: string | null; benchmark: string | null;
  condominium: string | null; targetAudience: string | null; foreign100pct: boolean; netAssets: number; netAssetsDate: string | null;
  startDate: string | null; manager: string | null; administrator: string | null; tags: string[];
  exposureType: "direta_indice" | "direta_cambial" | "indireta_acoes" | "credito_ou_imoveis_agro" | "multimercado_nao_verificada";
  exposureBasis: string;
  performance: null | {
    quotaDate: string; quota: number; netAssetsDaily: number | null; shareholders: number | null;
    return1m: number | null; return3m: number | null; return6m: number | null; return12m: number | null; returnYtd: number | null;
    volatility12m: number | null; maxDrawdown12m: number | null; observations: number; weekly: [string, number][];
  };
  documents: null | Record<string, string>;
  holdings?: FundHoldings | null;
}

export interface FundExposureEntry { weight: number | null; via: string[]; byVia: Record<string, number>; side: "long" | "short"; weighted: boolean }
export interface FundHoldings {
  month: string; pl: number; confidentialShare: number; positions: number;
  top: { label: string; type: string; weight: number }[];
  futures: { label: string; side: "long" | "short"; commodities: string[] }[];
  exposures: Record<string, FundExposureEntry>;
}

export interface Correlations {
  window: number; end: string; ids: string[]; generatedAt: string; method: string;
  pairs: Record<string, { r: number; n: number; ci: [number, number]; rollingMin: number | null; rollingMax: number | null; rollingStd: number | null }>;
}

// ---------------------------------------------------------------------------- leitura com cache por mtime

const cache = new Map<string, { mtime: number; value: unknown }>();

function readJson<T>(rel: string, fallback: T): T {
  const file = path.join(DATA_DIR, rel);
  try {
    const st = fs.statSync(file);
    const hit = cache.get(file);
    if (hit && hit.mtime === st.mtimeMs) return hit.value as T;
    const value = JSON.parse(fs.readFileSync(file, "utf-8")) as T;
    cache.set(file, { mtime: st.mtimeMs, value });
    return value;
  } catch {
    return fallback;
  }
}

export const getCatalog = () => readJson<Catalog>("catalog/instruments.json", { categories: [], instruments: [], currencies: [] });
export const getSummary = () => readJson<{ generatedAt: string | null; items: SummaryItem[] }>("market/summary.json", { generatedAt: null, items: [] });
export const getForecasts = () => readJson<{ generatedAt: string | null; engineVersion?: string; forecasts: Record<string, ForecastResult> }>("market/forecasts.json", { generatedAt: null, forecasts: {} });
export const getMacro = () => readJson<Macro>("market/macro.json", { indicators: {}, focus: null });
export const getIngestionLog = () => readJson<{ runs: Record<string, IngestionRun> }>("market/ingestion_log.json", { runs: {} });
export const getCompanies = () => readJson<{ fcaYear?: number; dfpFilesLoaded?: number[]; ingestedAt?: string; companies: CvmCompany[] }>("market/companies.json", { companies: [] });
export const getFunds = () => readJson<{ ingestedAt?: string; funds: Fund[] }>("market/funds.json", { funds: [] });
export const getCorrelations = () => readJson<Correlations | null>("market/correlations.json", null);
export const getForecastArchive = () => readJson<{ entries: { file: string; sha256: string; generatedAt: string; series: number }[] }>("market/forecast_archive/index.json", { entries: [] });

export function getSeries(id: string): Series | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return readJson<Series | null>(`market/series/${id}.json`, null);
}

export function getInstrument(id: string) {
  const cat = getCatalog();
  return cat.instruments.find((i) => i.id === id) ?? null;
}
export function getCurrency(id: string) {
  return getCatalog().currencies.find((c) => c.id === id) ?? null;
}
export function getSummaryItem(id: string) {
  return getSummary().items.find((i) => i.id === id) ?? null;
}
export function getCategory(id: string) {
  return getCatalog().categories.find((c) => c.id === id) ?? null;
}
export function categoryColor(id: string): string {
  return getCategory(id)?.color ?? "#64748b";
}

export function correlationBetween(a: string, b: string) {
  const c = getCorrelations();
  if (!c) return null;
  return c.pairs[`${a}|${b}`] ?? c.pairs[`${b}|${a}`] ?? null;
}

/** Itens visíveis conforme o modo de dados escolhido pelo usuário. */
export function visibleItems(mode: "all" | "real") {
  const items = getSummary().items;
  return mode === "real" ? items.filter((i) => i.dataMode === "real") : items;
}

export function findCompany(ticker: string): CvmCompany | null {
  const t = ticker.toUpperCase();
  return getCompanies().companies.find((c) => c.tickersGiven.includes(t)) ?? null;
}

export function findFund(cnpjDigits: string): Fund | null {
  return getFunds().funds.find((f) => f.cnpjDigits === cnpjDigits) ?? null;
}
