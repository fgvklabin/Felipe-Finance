"use client";

import { useMemo, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { historicalFrequency, simulate, type SimPosition } from "@/lib/simulator";
import type { FundSimExposure } from "@/lib/fund-exposure";
import { fmtPct } from "@/lib/format";
import { Badge, btnClass, cn, inputClass, labelClass } from "../ui";

export interface SimAsset { kind: SimPosition["kind"]; ref: string; label: string; demo?: boolean }

const PRESETS = [
  { label: "Açúcar +10%", c: { acucar: 0.1 } },
  { label: "Café −15%", c: { "cafe-arabica": -0.15 } },
  { label: "Celulose +8%", c: { "celulose-fibra-curta": 0.08 } },
  { label: "Petróleo +20%", c: { brent: 0.2 } },
  { label: "Dólar +5%", fx: 0.05 },
  { label: "Juros −1 p.p.", rate: -1 },
  { label: "Demanda de cobre ↑", q: "cobre" },
] as const;

export function Simulator({ assets, history, vol, funds }: { assets: SimAsset[]; history: Record<string, number[]>; vol: Record<string, number>; funds: { ref: string; label: string; fund: FundSimExposure | null }[] }) {
  const [positions, setPositions] = useState<SimPosition[]>([
    { kind: "commodity", ref: "ouro", label: "Ouro", weight: 20 },
    { kind: "usd", ref: "usd", label: "Dólar (caixa em US$)", weight: 20 },
    { kind: "stock", ref: "SUZB3", label: "SUZB3 — Suzano", weight: 20 },
    { kind: "cdi", ref: "cdi", label: "CDI", weight: 40 },
  ]);
  const [shocks, setShocks] = useState<Record<string, number>>({ acucar: 0.1 });
  const [fx, setFx] = useState(0);
  const [rate, setRate] = useState(0);
  const [qual, setQual] = useState<string[]>([]);
  const [horizon, setHorizon] = useState(3);
  const [add, setAdd] = useState("");
  const [fundSel, setFundSel] = useState("");

  const res = useMemo(() => simulate(positions, { commodities: shocks, usdbrl: fx, rateChangePp: rate, qualitative: qual, horizonMonths: horizon }, vol), [positions, shocks, fx, rate, qual, horizon, vol]);
  const demoShocked = Object.keys(shocks).filter((k) => assets.find((a) => a.ref === k)?.demo && shocks[k]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    if ("c" in p) setShocks((s) => ({ ...s, ...p.c }));
    if ("fx" in p) setFx(p.fx);
    if ("rate" in p) setRate(p.rate);
    if ("q" in p) setQual((q) => (q.includes(p.q) ? q : [...q, p.q]));
  };
  const commodityAssets = assets.filter((a) => a.kind === "commodity");

  return (
    <div className="grid gap-5 p-4 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-sm font-semibold">1. Carteira educacional</div>
          <div className="space-y-1">
            {positions.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_auto] items-center gap-1 text-xs">
                <span className="truncate">{p.label} <span className="text-muted">({p.kind})</span></span>
                <input className={cn(inputClass, "h-7 text-xs")} inputMode="decimal" value={p.weight} onChange={(e) => setPositions((ps) => ps.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) || 0 } : x)))} aria-label="Peso %" />
                <button onClick={() => setPositions((ps) => ps.filter((_, j) => j !== i))} className="text-muted hover:text-red-400" aria-label="Remover"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <select className={cn(inputClass, "h-8 text-xs")} value={add} onChange={(e) => setAdd(e.target.value)}>
              <option value="">+ ativo…</option>
              {assets.map((a) => <option key={a.kind + a.ref} value={`${a.kind}|${a.ref}`}>{a.label}{a.demo ? " (demo)" : ""}</option>)}
            </select>
            <button className={btnClass("outline", "sm")} onClick={() => { if (!add) return; const [kind, ref] = add.split("|"); const a = assets.find((x) => x.kind === kind && x.ref === ref)!; setPositions((p) => [...p, { kind: a.kind, ref: a.ref, label: a.label, weight: 10 }]); setAdd(""); }}><Plus size={13} /></button>
          </div>
          <div className="mt-2 flex gap-1">
            <select className={cn(inputClass, "h-8 text-xs")} value={fundSel} onChange={(e) => setFundSel(e.target.value)}>
              <option value="">+ fundo existente (CVM)…</option>
              {funds.map((f) => <option key={f.ref} value={f.ref}>{f.fund ? "✓ " : ""}{f.label}</option>)}
            </select>
            <button className={btnClass("outline", "sm")} onClick={() => { const f = funds.find((x) => x.ref === fundSel); if (f) setPositions((p) => [...p, { kind: "fund", ref: f.ref, label: f.label, weight: 10, fund: f.fund }]); setFundSel(""); }}><Plus size={13} /></button>
          </div>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">2. Cenário</div>
          <div className="mb-2 flex flex-wrap gap-1">{PRESETS.map((p) => <button key={p.label} onClick={() => applyPreset(p)} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-fg-2 hover:border-blue">{p.label}</button>)}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><label className={labelClass}>Dólar/real %</label><input className={cn(inputClass, "h-8 text-xs")} value={fx * 100} onChange={(e) => setFx((Number(e.target.value) || 0) / 100)} /></div>
            <div><label className={labelClass}>Juros (p.p.)</label><input className={cn(inputClass, "h-8 text-xs")} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} /></div>
            <div><label className={labelClass}>Horizonte (meses)</label><select className={cn(inputClass, "h-8 text-xs")} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>{[1, 3, 6, 12].map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
          </div>
          <div className="mt-2 space-y-1">
            {Object.entries(shocks).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[1fr_80px_auto] items-center gap-1 text-xs">
                <span>{commodityAssets.find((a) => a.ref === k)?.label ?? k}</span>
                <input className={cn(inputClass, "h-7 text-xs")} value={Math.round(v * 1000) / 10} onChange={(e) => setShocks((s) => ({ ...s, [k]: (Number(e.target.value) || 0) / 100 }))} aria-label="Choque %" />
                <button onClick={() => setShocks((s) => { const n = { ...s }; delete n[k]; return n; })} className="text-muted hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            ))}
            <select className={cn(inputClass, "h-8 text-xs")} value="" onChange={(e) => e.target.value && setShocks((s) => ({ ...s, [e.target.value]: 0.1 }))}>
              <option value="">+ choque em commodity…</option>
              {commodityAssets.map((a) => <option key={a.ref} value={a.ref}>{a.label}{a.demo ? " (demo)" : ""}</option>)}
            </select>
            {qual.length > 0 && <div className="text-[11px] text-muted">Fatores qualitativos: {qual.join(", ")} (sem tradução numérica) <button className="underline" onClick={() => setQual([])}>limpar</button></div>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase tracking-wide text-muted">Efeito direto estimado</div><div className={cn("num text-2xl font-semibold", res.directTotal >= 0 ? "text-up" : "text-down")}>{fmtPct(res.directTotal, 2)}</div><div className="text-xs text-muted">sobre {fmtPct(res.quantifiedWeight, 0, false)} da carteira com exposição verificável</div></div>
          <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase tracking-wide text-muted">Incerteza residual (±1σ, {horizon}m)</div><div className="num text-2xl font-semibold">±{fmtPct(res.sigma, 1, false)}</div><div className="text-xs text-muted">volatilidade histórica dos ativos diretos; ignora correlações</div></div>
          <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase tracking-wide text-muted">Sem estimativa numérica</div><div className="num text-2xl font-semibold">{fmtPct(1 - res.quantifiedWeight, 0, false)}</div><div className="text-xs text-muted">ações, fundos sem carteira verificada e partes não estimáveis</div></div>
        </div>
        {demoShocked.length > 0 && <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-2 text-xs">Choques em séries demonstrativas ({demoShocked.join(", ")}) só geram efeitos qualitativos: não há histórico real para medir frequência.</div>}
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[760px] text-[12.5px]">
            <thead><tr><th className="text-left">Posição</th><th className="text-right">Peso</th><th className="text-right">Efeito direto</th><th className="text-left">Efeitos e canais</th><th className="text-left">Informação faltante</th></tr></thead>
            <tbody>
              {res.lines.map((l, i) => (
                <tr key={i}>
                  <td className="font-medium">{l.label}</td>
                  <td className="num text-right">{fmtPct(l.weight, 0, false)}</td>
                  <td className="num text-right">{l.direct !== null ? <span className={l.direct >= 0 ? "text-up" : "text-down"}>{fmtPct(l.direct, 2)}</span> : <Badge>qualitativo</Badge>}</td>
                  <td className="text-xs">{l.effects.length ? l.effects.map((e, j) => <div key={j} className={e.direction === "positive" ? "text-up" : e.direction === "negative" ? "text-down" : "text-gold"}>• {e.text}</div>) : <span className="text-muted">sem efeito de primeira ordem catalogado</span>}</td>
                  <td className="text-xs text-muted">{l.missing ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-line p-3 text-[12.5px]">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><Info size={14} className="text-blue" /> Sensibilidade histórica (dados reais)</div>
          <ul className="space-y-0.5 text-fg-2">
            {Object.entries(shocks).filter(([, v]) => v).map(([k, v]) => {
              const h = history[k] ? historicalFrequency(history[k], horizon, v) : null;
              return <li key={k}>{assets.find((a) => a.ref === k)?.label ?? k}: {h ? <>variações de {fmtPct(v)} ou {v > 0 ? "mais" : "menos"} em {horizon} meses ocorreram em <b>{fmtPct(h.freq, 0, false)}</b> das janelas do histórico disponível (n={h.n}).</> : "sem histórico real."}</li>;
            })}
            {fx !== 0 && history.usdbrl && (() => { const h = historicalFrequency(history.usdbrl, horizon, fx); return <li>Dólar/real: variações de {fmtPct(fx)} em {horizon} meses ocorreram em <b>{h ? fmtPct(h.freq, 0, false) : "—"}</b> das janelas (médias mensais PTAX, n={h?.n}).</li>; })()}
          </ul>
        </div>
        <p className="text-[11px] text-muted">
          Premissas: commodities representam exposição ao benchmark internacional em US$ convertida em reais; caixa em dólar acompanha a PTAX; CDI acompanha a mudança de juros no horizonte. Não há efeitos de segunda ordem, hedge, impostos ou custos.
          Resultados hipotéticos não representam retorno esperado nem garantido.
        </p>
      </div>
    </div>
  );
}
