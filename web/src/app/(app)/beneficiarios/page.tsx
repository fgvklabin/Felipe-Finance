import Link from "next/link";
import { Card, CardBody, CardHeader, Disclaimer, PageHeader } from "@/components/ui";
import { Change, DataBadge, ForecastArrow } from "@/components/market/bits";
import { FundList, StockList } from "@/components/BeneficiariesPanel";
import { beneficiaryCounts, fundsFor, nameOnlyFunds, stocksFor } from "@/lib/beneficiaries";
import { getCatalog, getSummaryItem } from "@/lib/market";
import { fmtDate, fmtPrice } from "@/lib/format";

export const metadata = { title: "Ações e Fundos Beneficiados" };

export default async function BeneficiariesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const cat = getCatalog();
  const withAny = cat.instruments.map((i) => ({ i, n: beneficiaryCounts(i.id) })).filter((x) => x.n.stocks + x.n.funds > 0);
  const selected = cat.instruments.find((i) => i.id === c) ?? withAny[0]?.i;
  const item = selected ? getSummaryItem(selected.id) : null;
  const stocks = selected ? stocksFor(selected.id) : [];
  const funds = selected ? fundsFor(selected.id) : [];
  const nameOnly = selected ? nameOnlyFunds(selected.id) : [];
  const color = (id: string) => cat.categories.find((x) => x.id === id)?.color ?? "#64748b";
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inteligência"
        accent="var(--brand)"
        title="Ações e fundos que podem subir com a commodity"
        subtitle="Escolha uma commodity e veja quais empresas e fundos costumam ganhar quando o preço dela sobe."
      />
      <p className="text-sm text-muted">Lembre: a commodity subir <b>não garante</b> que a ação ou o fundo suba. Isto não é recomendação de investimento.</p>
      <div className="flex flex-wrap gap-1.5">
        {withAny.map(({ i, n }) => (
          <Link key={i.id} href={`/beneficiarios?c=${i.id}`} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${selected?.id === i.id ? "border-brand bg-brand/15 text-fg" : "border-line text-fg-2 hover:border-line-strong"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: color(i.category) }} />
            {i.name.pt} <span className="text-muted">{n.stocks}A · {n.funds}F</span>
          </Link>
        ))}
      </div>
      {selected && (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link href={`/commodity/${selected.id}`} className="text-lg font-semibold hover:text-blue">{selected.name.pt}</Link>
              <DataBadge mode={selected.dataMode} stale={item?.stats?.stale} />
              {item?.stats?.last !== undefined && selected.dataMode === "real" && (
                <>
                  <span className="num text-sm">{fmtPrice(item.stats.last)} <span className="text-xs text-muted">{item.unitLabel}</span></span>
                  <span className="text-sm">12m <Change v={item.stats.changes.y1} /></span>
                  <span className="text-sm">mês <Change v={item.stats.changes.m1} /></span>
                  <span className="text-xs text-muted">última observação {fmtDate(item.stats.lastDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}</span>
                  <span className="text-sm">Previsão 30d: <ForecastArrow f={item.forecast30d} /></span>
                </>
              )}
              {selected.dataMode === "demo" && <span className="text-xs text-violet-400">Preço demonstrativo — sem dado real licenciado para esta commodity.</span>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Ações (${stocks.length})`} subtitle="Empresas da bolsa que vendem esta commodity" accent="var(--blue)" />
            <CardBody><StockList stocks={stocks} /></CardBody>
          </Card>
          <Card>
            <CardHeader title={`Fundos (${funds.filter((f) => f.exposure.basis !== "nao_verificada").length})`} subtitle="Fundos que têm esta commodity na carteira declarada à CVM, ou que a acompanham pelo nome" accent="var(--gold)" />
            <CardBody><FundList funds={funds} nameOnly={nameOnly} /></CardBody>
          </Card>
        </>
      )}
      <Disclaimer />
    </div>
  );
}
