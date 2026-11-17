// Frases em linguagem simples para quem não é especialista.
import { fmtDate, fmtPct, fmtPrice } from "./format";
import type { ForecastResult, HorizonForecast, SummaryItem } from "./market";

export function moved(v: number | null | undefined, period: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return `sem dados para ${period}`;
  if (Math.abs(v) < 0.005) return `ficou praticamente igual ${period}`;
  return `${v > 0 ? "subiu" : "caiu"} ${fmtPct(Math.abs(v)).replace("+", "")} ${period}`;
}

export function monthName(iso: string | null | undefined) {
  return fmtDate(iso, "pt", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Melhor horizonte publicado (não expirado) para resumir a previsão. */
export function bestHorizon(fc: ForecastResult | undefined): [string, HorizonForecast] | null {
  if (!fc) return null;
  for (const h of ["90d", "30d", "180d", "7d", "12m"]) {
    const x = fc.horizons[h];
    if (x?.status === "ok" && x.central !== undefined) return [h, x];
  }
  return null;
}

const H_TEXT: Record<string, string> = { "7d": "na próxima semana", "30d": "no próximo mês", "90d": "nos próximos 3 meses", "180d": "nos próximos 6 meses", "12m": "nos próximos 12 meses" };

/** Uma frase sobre o futuro, sem jargão. */
export function forecastSentence(fc: ForecastResult | undefined, unit = ""): string {
  const best = bestHorizon(fc);
  if (!best) {
    const anyExpired = fc && Object.values(fc.horizons).some((h) => h.status === "expired");
    return anyExpired
      ? "Ainda não dá para prever: a fonte oficial não publicou dados recentes."
      : "Não há dados suficientes para uma previsão confiável.";
  }
  const [h, x] = best;
  const range = `entre ${fmtPrice(x.low)} e ${fmtPrice(x.high)}${unit ? " " + unit : ""}`;
  if (!x.beatsBaseline) return `Sem tendência clara ${H_TEXT[h]}: o mais provável é ficar perto do preço atual, ${range}.`;
  return `Os modelos apontam ${x.direction === "up" ? "alta" : x.direction === "down" ? "queda" : "estabilidade"} ${H_TEXT[h]}, com faixa provável ${range}.`;
}

export function storyFor(item: SummaryItem, fc: ForecastResult | undefined, drivers: string[]): string[] {
  const s = item.stats;
  const monthly = item.frequency === "monthly";
  const out: string[] = [];
  out.push(`O preço ${moved(s.changes.y1, "em 12 meses")} e ${moved(monthly ? s.changes.m1 : s.changes.d1, monthly ? "no último mês" : "no último dia")}.`);
  if (drivers.length) out.push(`O que mais mexe com esse preço: ${drivers.slice(0, 3).join("; ")}.`);
  out.push(forecastSentence(fc, item.unitLabel));
  if (s.stale) out.push(`Atenção: o último dado oficial é de ${monthName(s.lastDate)}.`);
  return out;
}
