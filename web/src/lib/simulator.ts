// Simulador de cenários para carteiras educacionais. Só produz números para exposições DIRETAS e verificáveis.

import { IMPACT_LINKS } from "./impact";

export interface SimPosition { kind: "commodity" | "usd" | "cdi" | "stock" | "fund"; ref: string; label: string; weight: number; verifiedExposure?: boolean }
export interface SimShocks { commodities: Record<string, number>; usdbrl: number; rateChangePp: number; qualitative: string[]; horizonMonths: number }
export interface SimVol { [ref: string]: number | undefined } // volatilidade anualizada (decimal)

export interface SimLine {
  ref: string; label: string; weight: number; kind: SimPosition["kind"];
  direct: number | null; // contribuição ao retorno da carteira (decimal)
  effects: { direction: "positive" | "negative" | "mixed"; text: string }[];
  missing: string | null;
}

export function simulate(positions: SimPosition[], s: SimShocks, vol: SimVol) {
  const totalW = positions.reduce((a, p) => a + p.weight, 0) || 1;
  const lines: SimLine[] = positions.map((p) => {
    const w = p.weight / totalW;
    const effects: SimLine["effects"] = [];
    let direct: number | null = null;
    let missing: string | null = null;
    if (p.kind === "commodity") {
      const sc = s.commodities[p.ref] ?? 0;
      direct = w * ((1 + sc) * (1 + s.usdbrl) - 1);
      if (sc) effects.push({ direction: sc > 0 ? "positive" : "negative", text: `Choque direto de ${(sc * 100).toFixed(1)}% no preço em US$` });
      if (s.usdbrl) effects.push({ direction: s.usdbrl > 0 ? "positive" : "negative", text: `Conversão para reais: dólar ${(s.usdbrl * 100).toFixed(1)}%` });
    } else if (p.kind === "usd") {
      direct = w * s.usdbrl;
      if (s.usdbrl) effects.push({ direction: s.usdbrl > 0 ? "positive" : "negative", text: "Exposição direta ao dólar" });
    } else if (p.kind === "cdi") {
      direct = w * (s.rateChangePp / 100) * (s.horizonMonths / 12);
      if (s.rateChangePp) effects.push({ direction: s.rateChangePp > 0 ? "positive" : "negative", text: `Rendimento do CDI no horizonte muda ~${(s.rateChangePp * s.horizonMonths / 12).toFixed(2)} p.p. (supondo repasse imediato)` });
    } else {
      // Ações e fundos: sensibilidade não verificada → apenas efeitos qualitativos
      missing = p.kind === "stock"
        ? "Sensibilidade da ação não verificada (sem cotações licenciadas para estimar beta)."
        : "Exposição do fundo não verificada (carteira CDA não analisada).";
      const drivers = [...Object.keys(s.commodities).filter((k) => s.commodities[k] !== 0), ...(s.usdbrl ? ["usdbrl"] : []), ...s.qualitative];
      for (const d of drivers) {
        const shock = d === "usdbrl" ? s.usdbrl : s.commodities[d] ?? 1;
        for (const l of IMPACT_LINKS.filter((x) => x.driver === d)) {
          for (const e of l.effects) {
            const matches = p.kind === "stock" ? e.ref === p.ref : e.targetType === "fund_type";
            if (!matches) continue;
            const dir = e.direction === "mixed" ? "mixed" : (e.direction === "positive") === shock > 0 ? "positive" : "negative";
            effects.push({ direction: dir, text: `${l.driverLabel} ${shock > 0 ? "em alta" : "em queda"}: ${e.channel}` });
          }
        }
      }
    }
    return { ref: p.ref, label: p.label, weight: w, kind: p.kind, direct, effects, missing };
  });
  const quantified = lines.filter((l) => l.direct !== null);
  const directTotal = quantified.reduce((a, l) => a + (l.direct ?? 0), 0);
  const h = Math.sqrt(s.horizonMonths / 12);
  // Incerteza residual (aproximação que ignora correlações): ±1 desvio-padrão dos ativos diretos no horizonte
  const sigma = Math.sqrt(quantified.reduce((a, l) => a + Math.pow(l.weight * (vol[l.ref] ?? 0) * h, 2), 0));
  return { lines, directTotal, quantifiedWeight: quantified.reduce((a, l) => a + l.weight, 0), sigma };
}

/** Frequência histórica de variações de |x| ou mais em janelas de k meses (dados mensais reais). */
export function historicalFrequency(monthly: number[], k: number, move: number): { freq: number; n: number } | null {
  if (monthly.length < k + 24 || move === 0) return null;
  let hits = 0, n = 0;
  for (let i = k; i < monthly.length; i++) {
    const r = monthly[i] / monthly[i - k] - 1;
    n++;
    if (move > 0 ? r >= move : r <= move) hits++;
  }
  return { freq: hits / n, n };
}
