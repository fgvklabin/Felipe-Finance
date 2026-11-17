import type { Catalog, SummaryItem } from "./market";

// Linha serializável usada por tabelas e heatmaps no cliente.
export interface MarketRow {
  id: string; name: string; category: string; categoryName: string; color: string; type: "instrument" | "currency";
  dataMode: string; stale: boolean; frequency: string; last: number | null; lastDate: string | null;
  unitLabel: string; currency: string; d1: number | null; w1: number | null; m1: number | null; m3: number | null; y1: number | null; ytd: number | null;
  volatility: number | null; spark: number[]; fcDir: string | null; fcStatus: string | null; fcBeats: boolean; source: string; href: string;
}

export function toRows(items: SummaryItem[], cat: Catalog, locale: "pt" | "en" = "pt"): MarketRow[] {
  const catMap = new Map(cat.categories.map((c) => [c.id, c]));
  return items
    .filter((i) => i.stats && i.stats.status !== "no_data")
    .map((i) => {
      const c = catMap.get(i.category);
      const s = i.stats;
      return {
        id: i.id,
        name: i.name[locale] ?? i.name.pt,
        category: i.category,
        categoryName: c?.name[locale] ?? i.category,
        color: c?.color ?? "#64748b",
        type: i.type,
        dataMode: i.dataMode,
        stale: !!s.stale,
        frequency: i.frequency ?? "monthly",
        last: s.last ?? null,
        lastDate: s.lastDate ?? null,
        unitLabel: i.unitLabel ?? i.unit ?? "",
        currency: i.currency ?? "",
        d1: s.changes?.d1 ?? null, w1: s.changes?.w1 ?? null, m1: s.changes?.m1 ?? null, m3: s.changes?.m3 ?? null,
        y1: s.changes?.y1 ?? null, ytd: s.changes?.ytd ?? null,
        volatility: s.volatility ?? null,
        spark: s.spark ?? [],
        fcDir: i.forecast30d?.direction ?? null,
        fcStatus: i.forecast30d?.status ?? null,
        fcBeats: !!i.forecast30d?.beatsBaseline,
        source: i.source?.label ?? "",
        href: i.type === "currency" ? `/moedas/${i.id}` : `/commodity/${i.id}`,
      };
    });
}
