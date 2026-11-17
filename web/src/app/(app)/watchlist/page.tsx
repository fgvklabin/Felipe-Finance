import Link from "next/link";
import { Card, CardHeader, Disclaimer, Empty, PageHeader, Badge } from "@/components/ui";
import { Change, DataBadge, Sparkline } from "@/components/market/bits";
import { RemoveWatch } from "@/components/RemoveWatch";
import { requireUser } from "@/lib/auth";
import { listWatchItems } from "@/lib/watchlist";
import { findCompany, findFund, getSummaryItem } from "@/lib/market";
import { fmtCompact, fmtDate, fmtPrice } from "@/lib/format";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const user = await requireUser("/watchlist");
  const items = await listWatchItems(user.id);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Pessoal" title="Minha watchlist" subtitle="Tudo o que você acompanha, num só lugar. Adicione pela estrela nas páginas de commodities, moedas, empresas e fundos." />
      <Card>
        <CardHeader title={`${items.length} itens`} />
        {items.length === 0 ? <div className="p-4"><Empty title="Sua watchlist está vazia">Abra uma commodity, moeda, empresa ou fundo e clique em “Watchlist”.</Empty></div> : (
          <div className="overflow-x-auto">
            <table className="fin-table w-full min-w-[760px] text-[13px]">
              <thead><tr><th className="text-left">Item</th><th>Tipo</th><th className="text-right">Último</th><th className="text-right">Variação</th><th className="text-center">Tendência</th><th>Data</th><th /></tr></thead>
              <tbody>
                {items.map((w) => {
                  if (w.item_type === "commodity" || w.item_type === "currency") {
                    const it = getSummaryItem(w.item_ref);
                    return (
                      <tr key={w.item_type + w.item_ref}>
                        <td><Link href={w.item_type === "currency" ? `/moedas/${w.item_ref}` : `/commodity/${w.item_ref}`} className="font-medium hover:text-blue">{it?.name.pt ?? w.item_ref}</Link> {it && <DataBadge mode={it.dataMode} stale={it.stats?.stale} />}</td>
                        <td className="text-center"><Badge>{w.item_type === "currency" ? "moeda" : "commodity"}</Badge></td>
                        <td className="num text-right">{fmtPrice(it?.stats?.last)} <span className="text-[10px] text-muted">{it?.unitLabel}</span></td>
                        <td className="text-right"><Change v={it?.frequency === "daily" ? it?.stats?.changes.d1 : it?.stats?.changes.m1} /> <span className="text-[10px] text-muted">{it?.frequency === "daily" ? "dia" : "mês"}</span></td>
                        <td className="text-center"><Sparkline data={it?.stats?.spark ?? []} /></td>
                        <td className="num text-xs text-muted">{fmtDate(it?.stats?.lastDate)}</td>
                        <td><RemoveWatch itemType={w.item_type} itemRef={w.item_ref} /></td>
                      </tr>
                    );
                  }
                  if (w.item_type === "company") {
                    const c = findCompany(w.item_ref);
                    const f = c?.financials.at(-1);
                    return (
                      <tr key={w.item_type + w.item_ref}>
                        <td><Link href={`/empresas/${w.item_ref}`} className="font-medium hover:text-blue">{w.item_ref} — {c?.name}</Link></td>
                        <td className="text-center"><Badge tone="blue">empresa</Badge></td>
                        <td className="num text-right">{fmtCompact(f?.revenue)} <span className="text-[10px] text-muted">receita {f?.fiscalYear}</span></td>
                        <td className="text-right text-xs text-muted">cotação requer licença</td>
                        <td /><td className="num text-xs text-muted">{fmtDate(f?.fiscalYearEnd)}</td>
                        <td><RemoveWatch itemType="company" itemRef={w.item_ref} /></td>
                      </tr>
                    );
                  }
                  const fund = w.item_type === "fund" ? findFund(w.item_ref) : null;
                  return (
                    <tr key={w.item_type + w.item_ref}>
                      <td>{fund ? <Link href={`/fundos/${w.item_ref}`} className="font-medium hover:text-blue">{fund.name}</Link> : w.item_ref}</td>
                      <td className="text-center"><Badge tone="gold">{w.item_type === "fund" ? "fundo" : w.item_type}</Badge></td>
                      <td className="num text-right">{fund?.performance ? fmtPrice(fund.performance.quota) : "—"}</td>
                      <td className="text-right"><Change v={fund?.performance?.return12m} /> <span className="text-[10px] text-muted">12m</span></td>
                      <td className="text-center"><Sparkline data={fund?.performance?.weekly.slice(-26).map((x) => x[1]) ?? []} /></td>
                      <td className="num text-xs text-muted">{fmtDate(fund?.performance?.quotaDate)}</td>
                      <td><RemoveWatch itemType={w.item_type} itemRef={w.item_ref} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Disclaimer />
    </div>
  );
}
