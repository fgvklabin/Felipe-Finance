"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import type { MarketRow } from "@/lib/rows";
import { fmtDate, fmtPrice } from "@/lib/format";
import { Change, DataBadge, ForecastArrow, Sparkline } from "./bits";
import { cn, inputClass } from "../ui";

type SortKey = "name" | "last" | "d1" | "w1" | "m1" | "y1" | "ytd" | "volatility";

export function MarketTable({ rows, showCategoryFilter = true, compact }: { rows: MarketRow[]; showCategoryFilter?: boolean; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const categories = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    rows.forEach((r) => m.set(r.category, { name: r.categoryName, color: r.color }));
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const out = rows.filter((r) => (cat === "all" || r.category === cat) && (!qq || r.name.toLowerCase().includes(qq) || r.id.includes(qq)));
    return out.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "pt") * sort.dir;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return ((av as number) - (bv as number)) * sort.dir;
    });
  }, [rows, q, cat, sort]);

  const th = (key: SortKey, label: string, cls?: string) => (
    <th className={cn("cursor-pointer select-none", cls)} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowDownUp size={10} className={sort.key === key ? "text-fg" : "opacity-40"} />
      </span>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" className={cn(inputClass, "h-8 pl-8 text-xs")} aria-label="Filtrar tabela" />
        </div>
        {showCategoryFilter && categories.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setCat("all")} className={cn("rounded-md border px-2 py-1 text-[11px]", cat === "all" ? "border-line-strong bg-panel-2 text-fg" : "border-line text-muted")}>Todas</button>
            {categories.map(([id, c]) => (
              <button key={id} onClick={() => setCat(id)} className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]", cat === id ? "border-line-strong bg-panel-2 text-fg" : "border-line text-muted")}>
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-[11px] text-muted">{filtered.length} ativos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[980px] text-left text-[13px]">
          <thead>
            <tr>
              {th("name", "Ativo")}
              {th("last", "Preço", "text-right")}
              <th>Unidade</th>
              {th("d1", "Dia", "text-right")}
              {th("w1", "Semana", "text-right")}
              {th("m1", "Mês", "text-right")}
              {th("y1", "12m", "text-right")}
              {!compact && th("ytd", "No ano", "text-right")}
              <th className="text-center">Histórico</th>
              <th>Previsão 30d</th>
              <th>Atualização</th>
              {!compact && <th>Fonte</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={cn(r.dataMode === "demo" && "opacity-80")}>
                <td className="max-w-[260px]">
                  <Link href={r.href} className="flex items-center gap-2 font-medium text-fg hover:text-blue">
                    <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="truncate">{r.name}</span>
                    <DataBadge mode={r.dataMode as "real"} stale={r.stale} />
                  </Link>
                </td>
                <td className="num text-right font-semibold">{fmtPrice(r.last)}</td>
                <td className="whitespace-nowrap text-xs text-muted">{r.unitLabel}</td>
                <td className="text-right">{r.frequency === "daily" ? <Change v={r.d1} digits={2} /> : <span className="text-[11px] text-muted" title="Fonte mensal: sem variação diária">mensal</span>}</td>
                <td className="text-right">{r.frequency === "daily" ? <Change v={r.w1} /> : <span className="text-muted">—</span>}</td>
                <td className="text-right"><Change v={r.m1} /></td>
                <td className="text-right"><Change v={r.y1} /></td>
                {!compact && <td className="text-right"><Change v={r.ytd} /></td>}
                <td className="text-center"><Sparkline data={r.spark} /></td>
                <td>{r.dataMode === "demo" ? <span className="text-[11px] text-muted">n/a (demo)</span> : <ForecastArrow f={{ status: r.fcStatus ?? undefined, direction: r.fcDir ?? undefined, beatsBaseline: r.fcBeats }} />}</td>
                <td className="num whitespace-nowrap text-xs text-muted">{r.frequency === "monthly" ? fmtDate(r.lastDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" }) : fmtDate(r.lastDate)}</td>
                {!compact && <td className="max-w-[200px] truncate text-[11px] text-muted" title={r.source}>{r.source}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
