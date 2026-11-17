import Link from "next/link";
import type { MarketRow } from "@/lib/rows";
import { fmtPrice } from "@/lib/format";
import { Change } from "./bits";

export function TickerTape({ rows }: { rows: MarketRow[] }) {
  if (!rows.length) return null;
  const items = [...rows, ...rows];
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-panel">
      <div className="animate-ticker flex w-max gap-6 px-4 py-2">
        {items.map((r, i) => (
          <Link key={`${r.id}-${i}`} href={r.href} className="flex items-center gap-2 whitespace-nowrap text-xs">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
            <span className="font-medium text-fg-2">{r.name}</span>
            <span className="num font-semibold text-fg">{fmtPrice(r.last)}</span>
            <Change v={r.frequency === "daily" ? r.d1 : r.m1} digits={2} />
            {r.frequency === "monthly" && <span className="text-[10px] text-muted">m/m</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
