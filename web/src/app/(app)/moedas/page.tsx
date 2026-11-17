import Link from "next/link";
import { Card, CardBody, CardHeader, Disclaimer, PageHeader, Badge } from "@/components/ui";
import { Change, DataBadge, Sparkline } from "@/components/market/bits";
import { MiniLine } from "@/components/charts/MiniLine";
import { getCatalog, getMacro, getSummaryItem } from "@/lib/market";
import { fmtDate, fmtNumber, fmtPrice } from "@/lib/format";

export const metadata = { title: "Moedas" };

export default function CurrenciesPage() {
  const cat = getCatalog();
  const macro = getMacro();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Câmbio"
        accent="#38BDF8"
        title="Moedas e indicadores econômicos"
        subtitle="PTAX do Banco Central, taxas de referência do BCE e moedas ligadas a commodities. As relações com commodities são instáveis e não garantidas."
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[980px] text-[13px]">
            <thead>
              <tr><th className="text-left">Par</th><th className="text-right">Cotação</th><th className="text-left">Unidade</th><th className="text-right">Dia</th><th className="text-right">Semana</th><th className="text-right">Mês</th><th className="text-right">12m</th><th className="text-right">No ano</th><th className="text-center">120 dias</th><th>Data</th><th>Fonte</th></tr>
            </thead>
            <tbody>
              {cat.currencies.map((c) => {
                const it = getSummaryItem(c.id);
                const s = it?.stats;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/moedas/${c.id}`} className="flex items-center gap-2 font-medium hover:text-blue">
                        <span className="h-6 w-1 rounded-full bg-[#38BDF8]" /> {c.pair} <span className="text-xs font-normal text-muted">{c.name.pt}</span> <DataBadge mode={c.dataMode} stale={s?.stale} />
                      </Link>
                    </td>
                    {c.dataMode === "unavailable" || !s?.last ? (
                      <td colSpan={10} className="text-xs text-muted">{c.description}</td>
                    ) : (
                      <>
                        <td className="num text-right font-semibold">{fmtNumber(s.last, 4)}</td>
                        <td className="text-xs text-muted">{c.unitLabel}</td>
                        <td className="text-right"><Change v={s.changes.d1} digits={2} /></td>
                        <td className="text-right"><Change v={s.changes.w1} /></td>
                        <td className="text-right"><Change v={s.changes.m1} /></td>
                        <td className="text-right"><Change v={s.changes.y1} /></td>
                        <td className="text-right"><Change v={s.changes.ytd} /></td>
                        <td className="text-center"><Sparkline data={s.spark} /></td>
                        <td className="num text-xs text-muted">{fmtDate(s.lastDate)}</td>
                        <td className="max-w-[220px] truncate text-[11px] text-muted" title={it?.source?.label ?? ""}>{it?.source?.label}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Moedas ligadas a commodities" subtitle="Relações econômicas típicas — sujeitas a mudanças de regime" />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cat.currencies.map((c) => (
            <div key={c.id} className="rounded-lg border border-line p-3 text-[12.5px]">
              <div className="mb-1 flex items-center justify-between"><span className="font-semibold">{c.pair}</span><DataBadge mode={c.dataMode} /></div>
              <p className="text-fg-2">{c.commodityLink}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card id="indicadores">
        <CardHeader title="Indicadores econômicos" subtitle="Banco Central do Brasil — SGS" accent="var(--cyan)" />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.values(macro.indicators).map((ind) => {
            const last = ind.points[ind.points.length - 1];
            return (
              <div key={ind.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted"><span>{ind.name}</span><Badge tone="green">Real</Badge></div>
                <div className="num mt-1 text-xl font-semibold">{fmtNumber(last?.[1], 2)} <span className="text-xs font-normal text-muted">{ind.unit}</span></div>
                <div className="text-[11px] text-muted">{ind.frequency === "monthly" ? fmtDate(last?.[0], "pt", { month: "short", year: "numeric", timeZone: "UTC" }) : fmtDate(last?.[0])} · {ind.source}</div>
                <MiniLine points={ind.points.slice(ind.frequency === "daily" ? -400 : -60)} />
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Boletim Focus — expectativas de mercado" subtitle={macro.focus ? `Pesquisa de ${fmtDate(macro.focus.date)} · mediana (mín–máx) · respondentes` : "indisponível"} />
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[720px] text-[13px]">
            <thead><tr><th className="text-left">Indicador</th>{["2026", "2027", "2028", "2029", "2030"].map((y) => <th key={y} className="text-right">{y}</th>)}</tr></thead>
            <tbody>
              {["IPCA", "Selic", "Câmbio", "PIB Total"].map((ind) => (
                <tr key={ind}>
                  <td>{ind}</td>
                  {["2026", "2027", "2028", "2029", "2030"].map((y) => {
                    const it = macro.focus?.items.find((i) => i.Indicador === ind && i.DataReferencia === y);
                    return (
                      <td key={y} className="num text-right">
                        {it ? <><span className="font-semibold">{fmtNumber(it.Mediana, 2)}</span><div className="text-[10px] text-muted">{fmtPrice(it.Minimo)}–{fmtPrice(it.Maximo)} · {it.numeroRespondentes}</div></> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Disclaimer />
    </div>
  );
}
