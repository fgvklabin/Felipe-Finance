"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ImpactLink } from "@/lib/impact";
import { Badge, cn } from "../ui";

type Corr = Record<string, { r: number; n: number; ci: [number, number]; rollingMin: number | null; rollingMax: number | null } | null>;

const DIR_COLOR = { positive: "#10B981", negative: "#EF4444", mixed: "#F59E0B" } as const;
const TYPE_LABEL: Record<string, string> = { company: "Empresa", industry: "Setor", currency: "Moeda", fund_type: "Fundos", consumer: "Consumidor" };

export function RelationshipMap({ links, correlations, names }: { links: ImpactLink[]; correlations: Record<string, Corr>; names: Record<string, string> }) {
  const [driver, setDriver] = useState(links[0]?.driver);
  const [sel, setSel] = useState<string | null>(null);
  const link = links.find((l) => l.driver === driver)!;
  const corr = correlations[driver] ?? {};
  const nodes = useMemo(() => {
    const effects = link.effects.map((e) => ({ key: e.target, label: e.target, kind: e.targetType, color: DIR_COLOR[e.direction], effect: e, corr: null as null | { r: number } }));
    const corrNodes = (link.correlationWith ?? []).map((id) => ({ key: `corr-${id}`, label: names[id] ?? id, kind: "correlation", color: "#06B6D4", effect: null, corr: corr[id] ?? null }));
    return [...effects, ...corrNodes];
  }, [link, corr, names]);
  const W = 640, H = 440, cx = W / 2, cy = H / 2, R = 165;
  const selected = nodes.find((n) => n.key === sel);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {links.map((l) => (
            <button key={l.driver} onClick={() => { setDriver(l.driver); setSel(null); }} className={cn("rounded-full border px-3 py-1 text-xs", l.driver === driver ? "border-blue bg-blue/15 text-fg" : "border-line text-muted hover:text-fg")}>
              {l.driverLabel}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line bg-bg-2" role="img" aria-label={`Mapa de relações: ${link.scenario}`}>
          {nodes.map((n, i) => {
            const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a) * 0.85;
            const width = n.corr ? 1 + Math.abs(n.corr.r) * 5 : 2;
            return <line key={`l-${n.key}`} x1={cx} y1={cy} x2={x} y2={y} stroke={n.color} strokeOpacity={sel && sel !== n.key ? 0.15 : 0.6} strokeWidth={width} strokeDasharray={n.kind === "correlation" ? "4 4" : undefined} />;
          })}
          <g>
            <circle cx={cx} cy={cy} r={52} fill="var(--panel)" stroke="#3B82F6" strokeWidth={2} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--text)">{link.driverLabel}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9.5" fill="var(--muted)">cenário: alta</text>
          </g>
          {nodes.map((n, i) => {
            const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a) * 0.85;
            const label = n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label;
            return (
              <g key={n.key} onClick={() => setSel(n.key)} className="cursor-pointer" opacity={sel && sel !== n.key ? 0.45 : 1}>
                <circle cx={x} cy={y} r={sel === n.key ? 11 : 8} fill={n.color} stroke="var(--bg)" strokeWidth={2} />
                <text x={x} y={y + (y > cy ? 24 : -16)} textAnchor="middle" fontSize="10.5" fill="var(--text-2)">{label}</text>
                {n.corr && <text x={x} y={y + (y > cy ? 36 : -28)} textAnchor="middle" fontSize="9" fill="#06B6D4">r = {n.corr.r.toFixed(2)}</text>}
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#10B981]" /> efeito positivo</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#EF4444]" /> negativo</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> misto</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#06B6D4]" /> correlação histórica (tracejado; espessura ∝ |r|)</span>
        </div>
      </div>
      <div className="space-y-3 text-[12.5px]">
        <div className="rounded-lg border border-line p-3">
          <div className="mb-1 text-sm font-semibold">{link.scenario}</div>
          <p className="text-fg-2">{link.explanation}</p>
        </div>
        {selected ? (
          <div className="rounded-lg border border-line-strong p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-semibold">{selected.label}</span>
              {selected.effect && <Badge tone={selected.effect.direction === "positive" ? "green" : selected.effect.direction === "negative" ? "red" : "gold"}>{selected.effect.direction === "positive" ? "positivo" : selected.effect.direction === "negative" ? "negativo" : "misto"}</Badge>}
              <Badge>{selected.kind === "correlation" ? "Correlação" : TYPE_LABEL[selected.kind]}</Badge>
            </div>
            {selected.effect && <p className="text-fg-2"><b>Canal:</b> {selected.effect.channel}</p>}
            {selected.effect?.ref && <Link href={`/empresas/${selected.effect.ref}`} className="mt-1 inline-block text-blue underline">Ver análise da empresa {selected.effect.ref} →</Link>}
            {selected.kind === "correlation" && (selected.corr ? (
              <p className="text-fg-2">Correlação de retornos mensais (10 anos): <b>{selected.corr.r.toFixed(2)}</b>. Correlação não implica causalidade e varia ao longo do tempo.</p>
            ) : <p className="text-muted">Sem dados suficientes para calcular a correlação (série demonstrativa ou indisponível).</p>)}
          </div>
        ) : <p className="text-muted">Clique em um nó para ver o canal de transmissão.</p>}
        <div className="rounded-lg border border-line p-3">
          <div className="font-semibold">Fatores que podem compensar</div>
          <ul className="mt-1 list-disc pl-4 text-fg-2">{link.counterfactors.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div className="rounded-lg border border-line p-3 text-fg-2">
          <div><b>Incerteza:</b> {link.uncertainty}</div>
          <div className="mt-1"><b>Limitações:</b> {link.limitations}</div>
          <div className="mt-1"><b>Fontes:</b> {link.sources.join("; ")}</div>
          <div className="mt-1 text-[11px] text-muted">Sensibilidade numérica estimada apenas onde há dados verificados (ver Simulador de Cenários).</div>
        </div>
      </div>
    </div>
  );
}
