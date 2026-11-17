// Resultados trimestrais (CVM ITR) em linguagem simples. Funções puras (testadas).
import type { CompanyQuarter } from "./market";

/** "2026T3" → "3º tri/2026" */
export function quarterLabel(period: string) {
  return `${period.slice(-1)}º tri/${period.slice(0, 4)}`;
}

/** Média dos pontos (mensais ou diários) dentro do trimestre que termina em `end`. */
export function quarterAverage(points: [string, number][], end: string, frequency: "monthly" | "daily"): number | null {
  const m = Number(end.slice(5, 7));
  const start = `${end.slice(0, 4)}-${String(m - 2).padStart(2, "0")}-01`;
  const vals = points.filter(([d]) => d >= start && d <= end).map(([, v]) => v);
  // série mensal precisa dos 3 meses; diária, de pelo menos 40 pregões
  if (vals.length < (frequency === "monthly" ? 3 : 40)) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const bi = (v: number) => {
  const abs = Math.abs(v);
  const s = abs >= 1e9 ? `R$ ${(abs / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi` : `R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mi`;
  return v < 0 ? `−${s}` : s;
};
const pct = (v: number) => `${Math.abs(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

/** Frases curtas sobre o último trimestre. */
export function quarterStory(q: CompanyQuarter, commodity?: { name: string; change: number | null } | null): string[] {
  const out: string[] = [];
  const yoy = q.revenueYoY;
  out.push(`No ${quarterLabel(q.period)}, a empresa vendeu ${bi(q.revenue)}${yoy === undefined ? "." : Math.abs(yoy) < 0.01 ? ", praticamente igual ao mesmo trimestre do ano anterior." : `, ${pct(yoy)} ${yoy > 0 ? "a mais" : "a menos"} que um ano antes.`}`);
  if (q.netIncome !== undefined) {
    const prev = q.netIncomePrevYear;
    const now = q.netIncome >= 0 ? `Lucrou ${bi(q.netIncome)}` : `Teve prejuízo de ${bi(-q.netIncome)}`;
    out.push(prev === undefined ? `${now}.` : `${now} (um ano antes: ${prev >= 0 ? "lucro" : "prejuízo"} de ${bi(Math.abs(prev))}).`);
  }
  if (commodity && commodity.change !== null) {
    const c = commodity.change;
    out.push(`O preço médio de ${commodity.name} no trimestre ficou ${Math.abs(c) < 0.01 ? "estável" : `${pct(c)} ${c > 0 ? "acima" : "abaixo"}`} do mesmo período do ano anterior.`);
  }
  return out;
}
