"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function FinancialsChart({ data }: { data: { year: number; revenue: number; ebitda: number; net: number; margin: number }[] }) {
  const rows = data.map((d) => ({ year: String(d.year), revenue: +(d.revenue / 1e9).toFixed(2), ebitda: +(d.ebitda / 1e9).toFixed(2), net: +(d.net / 1e9).toFixed(2) }));
  return (
    <div className="h-[240px] px-2 pt-3">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} unit=" bi" width={56} />
          <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, n) => [`R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`, n]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="Receita" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ebitda" name="EBITDA calc." fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="net" name="Lucro líquido" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
