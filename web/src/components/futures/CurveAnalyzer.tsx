"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { analyzeCurve, type CurvePoint } from "@/lib/futures";
import { fmtPct, fmtPrice } from "@/lib/format";
import { Badge, btnClass, cn, inputClass } from "../ui";

function addMonths(n: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + n, 15);
  return d.toISOString().slice(0, 10);
}

// Curva DEMONSTRATIVA (fictícia) — apenas para ilustrar a ferramenta.
const DEMO_A: CurvePoint[] = [1, 3, 5, 7, 9, 12].map((m, i) => ({ contract: `DEMO${i + 1}`, expiration: addMonths(m), price: 100 + i * 1.6 + (i % 2) * 0.3, volume: null, openInterest: null }));
const DEMO_B: CurvePoint[] = [1, 3, 5, 7, 9, 12].map((m, i) => ({ contract: `DEMO${i + 1}`, expiration: addMonths(m), price: 104 - i * 1.1, volume: null, openInterest: null }));

export function CurveAnalyzer() {
  const [a, setA] = useState<CurvePoint[]>(DEMO_A);
  const [b, setB] = useState<CurvePoint[]>(DEMO_B);
  const [spot, setSpot] = useState("100");
  const [isDemo, setIsDemo] = useState(true);
  const s = Number(spot.replace(",", ".")) || null;
  const ra = useMemo(() => analyzeCurve(a, s), [a, s]);
  const rb = useMemo(() => analyzeCurve(b, s), [b, s]);
  const chart = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    ra.points.forEach((p) => m.set(p.expiration, { ...(m.get(p.expiration) ?? { exp: p.expiration }), A: p.price }));
    rb.points.forEach((p) => m.set(p.expiration, { ...(m.get(p.expiration) ?? { exp: p.expiration }), B: p.price }));
    return [...m.values()].sort((x, y) => String(x.exp).localeCompare(String(y.exp)));
  }, [ra, rb]);

  const editor = (rows: CurvePoint[], set: (r: CurvePoint[]) => void, label: string) => (
    <div>
      <div className="mb-1 text-xs font-semibold text-fg-2">{label}</div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.2fr_1fr_auto] gap-1">
            <input className={cn(inputClass, "h-8 text-xs")} value={r.contract} onChange={(e) => { const n = [...rows]; n[i] = { ...r, contract: e.target.value }; set(n); setIsDemo(false); }} aria-label="Código do contrato" />
            <input type="date" className={cn(inputClass, "h-8 text-xs")} value={r.expiration} onChange={(e) => { const n = [...rows]; n[i] = { ...r, expiration: e.target.value }; set(n); setIsDemo(false); }} aria-label="Vencimento" />
            <input className={cn(inputClass, "h-8 text-xs")} inputMode="decimal" value={String(r.price)} onChange={(e) => { const n = [...rows]; n[i] = { ...r, price: Number(e.target.value.replace(",", ".")) || 0 }; set(n); setIsDemo(false); }} aria-label="Preço de ajuste" />
            <button className={btnClass("ghost", "sm")} onClick={() => set(rows.filter((_, j) => j !== i))} aria-label="Remover vencimento"><Trash2 size={13} /></button>
          </div>
        ))}
        <button className={btnClass("outline", "sm")} onClick={() => set([...rows, { contract: "", expiration: addMonths(rows.length + 1), price: 0 }])}><Plus size={13} /> vencimento</button>
      </div>
    </div>
  );

  const structureBadge = (st: string) => <Badge tone={st === "contango" ? "blue" : st === "backwardation" ? "gold" : "neutral"}>{st}</Badge>;

  return (
    <div className="space-y-4 p-4">
      {isDemo && <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-fg-2"><b className="text-violet-400">DEMONSTRAÇÃO:</b> as curvas abaixo são fictícias. Substitua pelos ajustes oficiais que você tem direito de usar (ex.: relatório da sua corretora) para analisar uma curva real.</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
        {editor(a, setA, "Curva A (ex.: hoje)")}
        {editor(b, setB, "Curva B (ex.: data anterior)")}
        <div>
          <label className="mb-1 block text-xs font-semibold text-fg-2" htmlFor="spot">Preço spot / físico de referência</label>
          <input id="spot" className={inputClass} value={spot} onChange={(e) => setSpot(e.target.value)} inputMode="decimal" />
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted">Estrutura A</span>{structureBadge(ra.structure)}</div>
            <div className="flex justify-between"><span className="text-muted">Estrutura B</span>{structureBadge(rb.structure)}</div>
            <div className="flex justify-between"><span className="text-muted">1º → último (A)</span><span className="num">{fmtPct(ra.frontToBack)}</span></div>
            <div className="flex justify-between"><span className="text-muted">1º → último (B)</span><span className="num">{fmtPct(rb.frontToBack)}</span></div>
          </div>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer>
          <LineChart data={chart} margin={{ top: 5, right: 10, left: -6, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="exp" tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {s && <ReferenceLine y={s} stroke="#10B981" strokeDasharray="4 3" label={{ value: "spot", fill: "#10B981", fontSize: 10 }} />}
            <Line dataKey="A" name="Curva A" stroke="#3B82F6" strokeWidth={2} connectNulls />
            <Line dataKey="B" name="Curva B" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 3" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[640px] text-[12.5px]">
          <thead><tr><th className="text-left">Contrato (A)</th><th>Vencimento</th><th className="text-right">Dias</th><th className="text-right">Ajuste</th><th className="text-right">Base vs. spot</th><th className="text-right">Carrego anualizado</th></tr></thead>
          <tbody>
            {ra.points.map((p) => (
              <tr key={p.contract + p.expiration}>
                <td>{p.contract || "—"}</td><td className="num text-center">{p.expiration}</td><td className="num text-right">{p.days}</td>
                <td className="num text-right">{fmtPrice(p.price)}</td>
                <td className="num text-right">{p.basis !== null ? `${fmtPrice(p.basis)} (${fmtPct(p.basisPct)})` : "—"}</td>
                <td className="num text-right">{fmtPct(p.annualizedCarry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">
        <b>Contango</b>: vencimentos mais longos mais caros (custo de carregamento, juros, armazenagem). <b>Backwardation</b>: mais baratos (escassez presente, prêmio de conveniência).
        Preços futuros refletem expectativas e custos de carrego — não são previsões garantidas do preço spot futuro.
      </p>
    </div>
  );
}
