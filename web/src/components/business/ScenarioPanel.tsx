"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fxImpact, priceImpact, purchaseScenarios, type Material } from "@/lib/procurement";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Badge, cn, inputClass, labelClass } from "../ui";

export interface MaterialContext extends Material {
  marketName: string | null;
  forecasts: Record<"1" | "3" | "6", { central: number; low: number; high: number; model: string; beats: boolean } | null>;
  forecastNote: string | null;
  altSupplierPrice: number | null; altSupplierName: string | null;
}

export function ScenarioPanel({ materials, rateMonthly, selicLabel }: { materials: MaterialContext[]; rateMonthly: number; selicLabel: string }) {
  const [id, setId] = useState(materials[0]?.id ?? "");
  const [horizon, setHorizon] = useState<"1" | "3" | "6">("3");
  const [mode, setMode] = useState<"forecast" | "manual">("manual");
  const [manual, setManual] = useState({ central: "8", low: "-5", high: "20" });
  const [pass, setPass] = useState("100");
  const [premium, setPremium] = useState("3");
  const [delay, setDelay] = useState("1");
  const [fxShock, setFxShock] = useState("5");
  const m = materials.find((x) => x.id === id);
  const fc = m?.forecasts[horizon] ?? null;
  const useFc = mode === "forecast" && fc;
  const chg = useFc ? fc : { central: Number(manual.central) / 100, low: Number(manual.low) / 100, high: Number(manual.high) / 100 };
  const scenarios = useMemo(() => (m ? purchaseScenarios(m, {
    horizonMonths: Number(horizon), changeCentral: chg.central, changeLow: chg.low, changeHigh: chg.high, rateMonthly,
    fixedPremiumPct: Number(premium) || 0, delayMonths: Number(delay) || 1, altSupplierPrice: m.altSupplierPrice, passThrough: (Number(pass) || 0) / 100,
  }) : []), [m, horizon, chg.central, chg.low, chg.high, rateMonthly, premium, delay, pass]);
  if (!m) return <p className="p-4 text-sm text-muted">Cadastre uma matéria-prima para simular cenários.</p>;
  const imp = priceImpact(m, chg.central, (Number(pass) || 0) / 100);
  const fxi = fxImpact(m, (Number(fxShock) || 0) / 100);
  const best = scenarios.filter((s) => s.feasible && s.expected !== null).sort((a, b) => a.expected! - b.expected!)[0];

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-8">
        <div className="lg:col-span-2"><label className={labelClass}>Matéria-prima</label><select className={cn(inputClass, "h-8 text-xs")} value={id} onChange={(e) => setId(e.target.value)}>{materials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><label className={labelClass}>Horizonte</label><select className={cn(inputClass, "h-8 text-xs")} value={horizon} onChange={(e) => setHorizon(e.target.value as "1")}><option value="1">1 mês</option><option value="3">3 meses</option><option value="6">6 meses</option></select></div>
        <div><label className={labelClass}>Premissa de preço</label>
          <select className={cn(inputClass, "h-8 text-xs")} value={mode} onChange={(e) => setMode(e.target.value as "manual")}>
            <option value="manual">Cenário manual</option>
            <option value="forecast" disabled={!fc}>Forecast Avermont{fc ? "" : " (indisponível)"}</option>
          </select>
        </div>
        {mode === "manual" || !fc ? (
          <>
            <div><label className={labelClass}>Variação central %</label><input className={cn(inputClass, "h-8 text-xs")} value={manual.central} onChange={(e) => setManual({ ...manual, central: e.target.value })} /></div>
            <div><label className={labelClass}>Baixa %</label><input className={cn(inputClass, "h-8 text-xs")} value={manual.low} onChange={(e) => setManual({ ...manual, low: e.target.value })} /></div>
            <div><label className={labelClass}>Alta %</label><input className={cn(inputClass, "h-8 text-xs")} value={manual.high} onChange={(e) => setManual({ ...manual, high: e.target.value })} /></div>
          </>
        ) : <div className="text-xs text-fg-2 lg:col-span-3"><div className={labelClass}>Previsão usada</div>{fmtPct(fc.central)} (faixa {fmtPct(fc.low)} a {fmtPct(fc.high)}) · {fc.model}{!fc.beats && <span className="text-gold"> · sem ganho sobre o passeio aleatório</span>}</div>}
        <div><label className={labelClass}>Repasse ao seu custo %</label><input className={cn(inputClass, "h-8 text-xs")} value={pass} onChange={(e) => setPass(e.target.value)} title="Quanto da variação do benchmark chega ao seu preço de compra" /></div>
      </div>
      {m.forecastNote && <p className="text-[11px] text-muted">{m.forecastNote}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted">Impacto no custo mensal</div>
          <div className={cn("num text-xl font-semibold", imp.delta > 0 ? "text-down" : "text-up")}>{imp.delta >= 0 ? "+" : ""}{fmtMoney(imp.delta, "BRL", "pt", 0)}</div>
          <div className="num text-xs text-muted">de {fmtMoney(imp.monthlySpend, "BRL", "pt", 0)} para {fmtMoney(imp.newMonthlySpend, "BRL", "pt", 0)} · {fmtMoney(imp.annualDelta, "BRL", "pt", 0)}/ano</div>
          <div className="mt-1 text-[11px] text-muted">Supõe consumo constante e condições comerciais equivalentes.</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted"><span>Exposição cambial</span><input className={cn(inputClass, "h-6 w-16 px-1 text-xs")} value={fxShock} onChange={(e) => setFxShock(e.target.value)} aria-label="Choque cambial %" /></div>
          <div className="num text-xl font-semibold">{fmtMoney(fxi.delta, "BRL", "pt", 0)}/mês</div>
          <div className="text-xs text-muted">se o dólar variar {fmtPct(Number(fxShock) / 100)} sobre {fmtMoney(fxi.exposed, "BRL", "pt", 0)} atrelados ao US$</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted">Premissas</div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
            <label>Prêmio preço fixo %<input className={cn(inputClass, "h-7 text-xs")} value={premium} onChange={(e) => setPremium(e.target.value)} /></label>
            <label>Adiamento (meses)<input className={cn(inputClass, "h-7 text-xs")} value={delay} onChange={(e) => setDelay(e.target.value)} /></label>
          </div>
          <div className="mt-1 text-[11px] text-muted">Custo de capital: {selicLabel}. Armazenagem: {m.storage_cost_pct_month}% a.m.</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[900px] text-[12.5px]">
          <thead><tr><th className="text-left">Estratégia</th><th className="text-right">Custo esperado</th><th className="text-right">Faixa (baixa – alta)</th><th className="text-left">Vantagens</th><th className="text-left">Riscos e custos</th></tr></thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.id} className={cn(!s.feasible && "opacity-60")}>
                <td className="font-medium">{s.label} {best?.id === s.id && <Badge tone="blue">menor custo esperado</Badge>}{!s.feasible && <Badge tone="red">inviável</Badge>}</td>
                <td className="num text-right font-semibold">{s.expected !== null ? fmtMoney(s.expected, "BRL", "pt", 0) : "—"}</td>
                <td className="num text-right text-xs text-muted">{s.low !== null ? `${fmtMoney(s.low, "BRL", "pt", 0)} – ${fmtMoney(s.high, "BRL", "pt", 0)}` : "—"}</td>
                <td className="text-xs"><ul className="list-disc pl-4">{s.pros.map((p) => <li key={p}>{p}</li>)}</ul></td>
                <td className="text-xs">
                  <ul className="list-disc pl-4">{s.cons.map((p) => <li key={p}>{p}</li>)}</ul>
                  {s.warnings.map((w) => <div key={w} className="mt-1 flex gap-1 text-gold"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">
        “Menor custo esperado” é um resultado aritmético sob as premissas acima, não uma recomendação. Considere disponibilidade de estoque, capital de giro, requisitos de entrega, confiabilidade do fornecedor e a incerteza de preço (veja as faixas).
        {m.altSupplierName && <> Fornecedor alternativo: {m.altSupplierName} (melhor cotação verificada e válida).</>}
      </p>
    </div>
  );
}
