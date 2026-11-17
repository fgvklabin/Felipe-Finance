"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MarketRow } from "@/lib/rows";
import { fmtPct } from "@/lib/format";
import { cn } from "../ui";

const PERIODS = [
  { key: "m1", label: "1 mês" },
  { key: "m3", label: "3 meses" },
  { key: "y1", label: "12 meses" },
  { key: "ytd", label: "No ano" },
] as const;

function colorFor(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "rgba(100,116,139,0.18)";
  const a = Math.min(Math.abs(v) / 0.2, 1);
  const alpha = 0.18 + a * 0.62;
  return v >= 0 ? `rgba(16,185,129,${alpha})` : `rgba(239,68,68,${alpha})`;
}

export function Heatmap({ rows }: { rows: MarketRow[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("y1");
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; color: string; items: MarketRow[] }>();
    rows.forEach((r) => {
      if (!m.has(r.category)) m.set(r.category, { name: r.categoryName, color: r.color, items: [] });
      m.get(r.category)!.items.push(r);
    });
    return [...m.values()];
  }, [rows]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className={cn("rounded-md border px-2 py-1 text-[11px]", period === p.key ? "border-line-strong bg-panel-2 text-fg" : "border-line text-muted")}>
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted">Variação no período · séries mensais usam o último mês publicado</span>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span className="h-2 w-2 rounded-sm" style={{ background: g.color }} /> {g.name}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
              {g.items.map((r) => {
                const v = r[period];
                return (
                  <Link
                    key={r.id}
                    href={r.href}
                    title={`${r.name}: ${fmtPct(v)}${r.dataMode === "demo" ? " (DEMO)" : ""}`}
                    className={cn("relative flex h-16 flex-col justify-between overflow-hidden rounded-lg border border-white/5 p-2 transition-transform hover:scale-[1.03]", r.dataMode === "demo" && "border-dashed border-violet-400/40")}
                    style={{ background: colorFor(v) }}
                  >
                    <span className="truncate text-[11px] font-medium text-fg">{r.name}</span>
                    <span className="num text-sm font-semibold text-fg">{fmtPct(v)}</span>
                    {r.dataMode === "demo" && <span className="absolute right-1 top-1 text-[8px] font-bold text-violet-300">DEMO</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
