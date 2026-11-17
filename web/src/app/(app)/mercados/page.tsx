import Link from "next/link";
import { Card, CardBody, CardHeader, Disclaimer, PageHeader } from "@/components/ui";
import { Heatmap } from "@/components/market/Heatmap";
import { MarketTable } from "@/components/market/MarketTable";
import { ChangePill } from "@/components/market/bits";
import { PriceTypeLegend } from "@/components/market/PriceTypeLegend";
import { getCatalog, visibleItems } from "@/lib/market";
import { toRows } from "@/lib/rows";
import { getPrefs } from "@/lib/prefs";
import { CATEGORY_ROUTES } from "@/lib/nav";

export const metadata = { title: "Mercados" };

export default async function MarketsPage() {
  const prefs = await getPrefs();
  const cat = getCatalog();
  const rows = toRows(visibleItems(prefs.dataMode), cat, prefs.locale);
  const commodities = rows.filter((r) => r.type === "instrument");
  const routes = Object.entries(CATEGORY_ROUTES);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mercados" title="Todos os mercados" subtitle="Commodities agrícolas, metais, polímeros, químicos, papel e celulose, energia e moedas — com fonte, unidade e status de cada série." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {routes.map(([slug, ids]) => {
          const c = cat.categories.find((x) => x.id === ids[0])!;
          const its = commodities.filter((r) => ids.includes(r.category));
          const real = its.filter((r) => r.dataMode === "real" && r.y1 !== null);
          const avg = real.length ? real.reduce((a, r) => a + (r.y1 ?? 0), 0) / real.length : null;
          return (
            <Link key={slug} href={`/mercados/${slug}`} className="panel group p-3 transition-colors hover:border-line-strong">
              <div className="mb-2 h-1 w-10 rounded-full" style={{ background: c.color }} />
              <div className="text-sm font-semibold group-hover:text-blue">{slug === "metais" ? "Metais e preciosos" : c.name.pt}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>{its.length} séries · {its.filter((r) => r.dataMode === "real").length} reais</span>
                {avg !== null ? <ChangePill v={avg} /> : <span className="text-[10px]">só demo</span>}
              </div>
              <div className="mt-1 text-[10px] text-muted">média simples 12m (reais)</div>
            </Link>
          );
        })}
      </div>
      <PriceTypeLegend />
      <Card>
        <CardHeader title="Mapa de calor" accent="var(--blue)" />
        <CardBody><Heatmap rows={commodities} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Tabela de mercados" subtitle="Clique no nome para abrir o painel completo do ativo" />
        <MarketTable rows={rows} />
      </Card>
      <Disclaimer />
    </div>
  );
}
