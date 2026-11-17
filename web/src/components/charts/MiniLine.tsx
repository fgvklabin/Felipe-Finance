"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MiniLine({ points, color = "#06B6D4", height = 70 }: { points: [string, number][]; color?: string; height?: number }) {
  const data = points.map(([d, v]) => ({ d, v }));
  return (
    <div style={{ height }} className="mt-2">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="d" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
          <Line dataKey="v" stroke={color} dot={false} strokeWidth={1.6} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
