"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ForecastPoint { date: string; central: number; low: number; high: number; label: string }

/** Histórico (linha contínua) + previsão (tracejada) com banda de incerteza de 80%. */
export function ForecastChart({ history, forecasts, extra }: { history: [string, number][]; forecasts: ForecastPoint[]; extra?: { label: string; points: { date: string; value: number }[]; color: string }[] }) {
  const last = history[history.length - 1];
  const rows: Record<string, number | string | [number, number] | null>[] = history.map(([d, v]) => ({ date: d, hist: v }));
  if (last && forecasts.length) {
    rows[rows.length - 1] = { ...rows[rows.length - 1], fc: last[1], band: [last[1], last[1]] };
    for (const f of [...forecasts].sort((a, b) => a.date.localeCompare(b.date))) rows.push({ date: f.date, fc: f.central, band: [f.low, f.high], hLabel: f.label });
  }
  for (const e of extra ?? []) for (const p of e.points) rows.push({ date: p.date, [e.label]: p.value });
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <div className="h-[320px]">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} minTickGap={40} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} domain={["auto", "auto"]} width={64} tickFormatter={(v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 0 : 2 })} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--text)" }}
            formatter={(v: unknown, name) => {
              if (Array.isArray(v)) return [`${Number(v[0]).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} – ${Number(v[1]).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`, name];
              return [Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 }), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area dataKey="band" name="Intervalo de 80%" stroke="none" fill="#3B82F6" fillOpacity={0.15} connectNulls isAnimationActive={false} />
          <Line dataKey="hist" name="Histórico" stroke="var(--text-2)" dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
          <Line dataKey="fc" name="Previsão central (Avermont)" stroke="#3B82F6" strokeDasharray="6 4" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          {(extra ?? []).map((e) => (
            <Line key={e.label} dataKey={e.label} name={e.label} stroke={e.color} strokeWidth={0} dot={{ r: 4, fill: e.color }} isAnimationActive={false} />
          ))}
          {last && <ReferenceLine x={last[0]} stroke="var(--muted)" strokeDasharray="2 2" label={{ value: "último dado", fill: "var(--muted)", fontSize: 10, position: "insideTopLeft" }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
