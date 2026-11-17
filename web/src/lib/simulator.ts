// Simulador de cenários para carteiras educacionais. Só produz números para exposições DIRETAS e verificáveis.

import { IMPACT_LINKS } from "./impact";
import { monthLabel, type FundSimExposure } from "./fund-exposure";

const pp = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export interface SimPosition { kind: "commodity" | "usd" | "cdi" | "stock" | "fund"; ref: string; label: string; weight: number; fund?: FundSimExposure | null }
export interface SimShocks { commodities: Record<string, number>; usdbrl: number; rateChangePp: number; qualitative: string[]; horizonMonths: number }
export interface SimVol { [ref: string]: number | undefined } // volatilidade anualizada (decimal)

export interface SimLine {
  ref: string; label: string; weight: number; kind: SimPosition["kind"];
  direct: number | null; // contribuição ao retorno da carteira (decimal)
  covered: number; // parcela da carteira total efetivamente estimada
  sd: number; // desvio-padrão anualizado da parte estimada (já ponderado pelo peso)
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
    let covered = 0, sd = 0;
    if (p.kind === "commodity") {
      covered = w; sd = w * (vol[p.ref] ?? 0);
      const sc = s.commodities[p.ref] ?? 0;
      direct = w * ((1 + sc) * (1 + s.usdbrl) - 1);
      if (sc) effects.push({ direction: sc > 0 ? "positive" : "negative", text: `Choque direto de ${(sc * 100).toFixed(1)}% no preço em US$` });
      if (s.usdbrl) effects.push({ direction: s.usdbrl > 0 ? "positive" : "negative", text: `Conversão para reais: dólar ${(s.usdbrl * 100).toFixed(1)}%` });
    } else if (p.kind === "usd") {
      covered = w; sd = w * (vol.usd ?? 0);
      direct = w * s.usdbrl;
      if (s.usdbrl) effects.push({ direction: s.usdbrl > 0 ? "positive" : "negative", text: "Exposição direta ao dólar" });
    } else if (p.kind === "cdi") {
      covered = w;
      direct = w * (s.rateChangePp / 100) * (s.horizonMonths / 12);
      if (s.rateChangePp) effects.push({ direction: s.rateChangePp > 0 ? "positive" : "negative", text: `Rendimento do CDI no horizonte muda ~${(s.rateChangePp * s.horizonMonths / 12).toFixed(2)} p.p. (supondo repasse imediato)` });
    } else if (p.kind === "fund" && p.fund) {
      // Fundo com carteira verificada (CDA): estima só a parte DIRETA (ETFs, exterior, cotas, outros ativos)
      const fe = p.fund;
      let r = 0;
      for (const [c, wc] of Object.entries(fe.direct)) {
        const sc = s.commodities[c] ?? 0;
        r += wc * ((1 + sc) * (1 + s.usdbrl) - 1);
        if (sc || s.usdbrl) effects.push({ direction: (1 + sc) * (1 + s.usdbrl) >= 1 ? "positive" : "negative", text: `${pp(wc)} do fundo ligado a ${c} (carteira de ${monthLabel(fe.month)})` });
      }
      r += fe.usd * s.usdbrl;
      if (fe.usd > 0.005 && s.usdbrl) effects.push({ direction: s.usdbrl > 0 ? "positive" : "negative", text: `${pp(fe.usd)} em ativos no exterior (sem hedge informado)` });
      direct = w * r;
      const gaps: string[] = [];
      const share = Math.min(1, Object.values(fe.direct).reduce((a, b) => a + b, 0) + fe.usd);
      covered = w * share;
      sd = w * Math.sqrt(Object.entries(fe.direct).reduce((a, [c, wc]) => a + (wc * (vol[c] ?? 0)) ** 2, 0) + (fe.usd * (vol.usd ?? 0)) ** 2);
      gaps.push(share >= 0.995 ? "Número cobre todo o fundo (exposição direta)." : `Número cobre ${pp(share)} do fundo (exposição direta); o resto foi considerado sem efeito do choque.`);
      if (fe.stocks > 0.005) gaps.push(`${pp(fe.stocks)} em ações de produtoras: só efeito qualitativo.`);
      for (const f of fe.futures) {
        const sc = f.commodity === "usdbrl" ? s.usdbrl : s.commodities[f.commodity] ?? 0;
        if (sc) effects.push({ direction: "mixed", text: `Futuros ${f.side === "long" ? "comprados" : "vendidos"} em ${f.commodity}: tamanho não divulgado, ${f.side === "long" ? "amplia" : "reduz"} o efeito` });
      }
      if (fe.futures.length) gaps.push("Futuros sem tamanho divulgado não entram no número.");
      if (s.rateChangePp) gaps.push("Efeito dos juros no restante da carteira não estimado.");
      missing = gaps.join(" ");
    } else {
      // Ações e fundos: sensibilidade não verificada → apenas efeitos qualitativos
      missing = p.kind === "stock"
        ? "Sensibilidade da ação não verificada (sem cotações licenciadas para estimar beta)."
        : "Exposição do fundo não verificada (sem carteira CDA recente).";
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
    return { ref: p.ref, label: p.label, weight: w, kind: p.kind, direct, covered, sd, effects, missing };
  });
  const quantified = lines.filter((l) => l.direct !== null);
  const directTotal = quantified.reduce((a, l) => a + (l.direct ?? 0), 0);
  const h = Math.sqrt(s.horizonMonths / 12);
  // Incerteza residual (aproximação que ignora correlações): ±1 desvio-padrão dos ativos diretos no horizonte
  const sigma = Math.sqrt(quantified.reduce((a, l) => a + Math.pow(l.sd * h, 2), 0));
  return { lines, directTotal, quantifiedWeight: lines.reduce((a, l) => a + l.covered, 0), sigma };
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
