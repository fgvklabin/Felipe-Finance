"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";
import { inputClass } from "../ui";

const PALETTE = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444", "#F472B6"];

interface Option { id: string; label: string; demo?: boolean }

/** Compara séries normalizadas (base 100 na primeira data comum), em frequência mensal. */
export function CompareChart({ base, options, years = 5 }: { base: string; options: Option[]; years?: number }) {
  const [selected, setSelected] = useState<string[]>([base]);
  const [series, setSeries] = useState<Record<string, [string, number][]>>({});
  const [adding, setAdding] = useState("");

  useEffect(() => {
    selected.forEach(async (id) => {
      if (series[id]) return;
      const r = await fetch(`/api/market/series/${id}?monthly=1`);
      if (r.ok) {
        const d = await r.json();
        setSeries((s) => ({ ...s, [id]: d.points }));
      }
    });
  }, [selected, series]);

  const data = useMemo(() => {
    const ready = selected.filter((id) => series[id]?.length);
    if (!ready.length) return [];
    const maps = ready.map((id) => new Map(series[id].map(([d, v]) => [d.slice(0, 7), v])));
    const months = [...new Set(ready.flatMap((id) => series[id].map(([d]) => d.slice(0, 7))))].sort();
    const cutoff = months.length ? months[Math.max(0, months.length - years * 12)] : "";
    const common = months.filter((m) => m >= cutoff && maps.every((mp) => mp.has(m)));
    if (!common.length) return [];
    const b = maps.map((mp) => mp.get(common[0])!);
    return common.map((m) => {
      const row: Record<string, string | number> = { m };
      ready.forEach((id, i) => (row[id] = +((maps[i].get(m)! / b[i]) * 100).toFixed(2)));
      return row;
    });
  }, [selected, series, years]);

  const label = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {selected.map((id, i) => (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            {label(id)}
            {options.find((o) => o.id === id)?.demo && <span className="text-[9px] font-bold text-violet-400">DEMO</span>}
            {id !== base && (
              <button onClick={() => setSelected((s) => s.filter((x) => x !== id))} aria-label={`Remover ${label(id)}`} className="text-muted hover:text-fg"><X size={12} /></button>
            )}
          </span>
        ))}
        {selected.length < 6 && (
          <select
            value={adding}
            onChange={(e) => {
              if (e.target.value) setSelected((s) => [...s, e.target.value]);
              setAdding("");
            }}
            className={`${inputClass} h-8 w-56 text-xs`}
            aria-label="Adicionar série à comparação"
          >
            <option value="">+ Comparar com…</option>
            {options.filter((o) => !selected.includes(o.id)).map((o) => (
              <option key={o.id} value={o.id}>{o.label}{o.demo ? " (demo)" : ""}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-[11px] text-muted">Base 100 = primeiro mês comum · últimos {years} anos · médias mensais</span>
      </div>
      <div className="h-[300px]">
        {data.length ? (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="m" tick={{ fill: "var(--muted)", fontSize: 11 }} minTickGap={40} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--text)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selected.filter((id) => series[id]).map((id, i) => (
                <Line key={id} type="monotone" dataKey={id} name={label(id)} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={1.8} strokeDasharray={options.find((o) => o.id === id)?.demo ? "4 3" : undefined} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">Carregando séries…</div>
        )}
      </div>
    </div>
  );
}
