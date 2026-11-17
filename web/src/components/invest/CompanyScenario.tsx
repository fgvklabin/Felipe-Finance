"use client";

import { useState } from "react";
import { fmtCompact, fmtPct } from "@/lib/format";
import { cn, inputClass, labelClass } from "../ui";

/**
 * Cenário fundamental EDUCACIONAL: efeito de primeira ordem de uma variação de preço sobre receita e EBITDA,
 * com premissas inseridas pelo usuário (nenhuma premissa é preenchida automaticamente como fato).
 */
export function CompanyScenario({ revenue, ebitda, year, commodities }: { revenue: number; ebitda: number; year: number; commodities: { id: string; label: string }[] }) {
  const [c, setC] = useState(commodities[0]?.id ?? "");
  const [shock, setShock] = useState("10");
  const [revShare, setRevShare] = useState("");
  const [costShare, setCostShare] = useState("0");
  const [fx, setFx] = useState("0");
  const [usdRev, setUsdRev] = useState("");
  const s = Number(shock) / 100, rs = Number(revShare) / 100, cs = Number(costShare) / 100, f = Number(fx) / 100, ur = Number(usdRev) / 100;
  const ready = revShare !== "" && usdRev !== "";
  const costs = revenue - ebitda;
  const dRev = revenue * rs * s + revenue * ur * f;
  const dCost = costs * cs * s;
  const dEbitda = dRev - dCost;
  const newMargin = (ebitda + dEbitda) / (revenue + dRev);
  const field = (label: string, v: string, set: (x: string) => void, hint?: string) => (
    <div><label className={labelClass} title={hint}>{label}</label><input className={cn(inputClass, "h-8 text-xs")} inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder="informe" /></div>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div><label className={labelClass}>Commodity</label><select className={cn(inputClass, "h-8 text-xs")} value={c} onChange={(e) => setC(e.target.value)}>{commodities.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
        {field("Variação do preço %", shock, setShock)}
        {field("% da receita ligada a ela", revShare, setRevShare, "Consulte a receita por segmento no release de resultados")}
        {field("% dos custos ligados a ela", costShare, setCostShare)}
        {field("Variação do dólar %", fx, setFx)}
        {field("% da receita em dólar", usdRev, setUsdRev, "Consulte as notas explicativas / release")}
      </div>
      {ready ? (
        <div className="grid gap-3 text-[13px] md:grid-cols-3">
          <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase text-muted">Receita</div><div className="num text-lg font-semibold">{fmtCompact(revenue + dRev)}</div><div className="num text-xs text-muted">{dRev >= 0 ? "+" : ""}{fmtCompact(dRev)} vs. {year}</div></div>
          <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase text-muted">EBITDA calculado</div><div className="num text-lg font-semibold">{fmtCompact(ebitda + dEbitda)}</div><div className="num text-xs text-muted">{dEbitda >= 0 ? "+" : ""}{fmtCompact(dEbitda)} ({fmtPct(ebitda ? dEbitda / ebitda : null)})</div></div>
          <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase text-muted">Margem EBITDA</div><div className="num text-lg font-semibold">{fmtPct(newMargin, 1, false)}</div><div className="num text-xs text-muted">base {fmtPct(ebitda / revenue, 1, false)}</div></div>
        </div>
      ) : <p className="text-xs text-muted">Informe a parcela da receita ligada à commodity e a parcela em dólar (dados dos relatórios da companhia). A Avermont não preenche essas premissas automaticamente.</p>}
      <p className="text-[11px] text-muted">Cenário educacional de primeira ordem sobre a DFP de {year}: ignora volumes, hedge, contratos, impostos, efeitos financeiros e reação de custos. Não é estimativa de preço da ação nem recomendação.</p>
    </div>
  );
}
