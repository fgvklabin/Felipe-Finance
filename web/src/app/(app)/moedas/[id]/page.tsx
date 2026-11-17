import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader, Stat } from "@/components/ui";
import { Change, DataBadge, SourceLine } from "@/components/market/bits";
import { PriceChart } from "@/components/charts/PriceChart";
import { ForecastPanel } from "@/components/forecast/ForecastPanel";
import { AlertLink, WatchButton } from "@/components/WatchButton";
import { AskAi } from "@/components/ai/AskAi";
import { correlationBetween, getCatalog, getCurrency, getForecasts, getSeries, getSummaryItem } from "@/lib/market";
import { linksForDriver } from "@/lib/impact";
import { getCurrentUser } from "@/lib/auth";
import { isWatched } from "@/lib/watchlist";
import { focusValue } from "@/lib/insights";
import { fmtNumber, fmtPct, fmtPrice } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: getCurrency(id)?.pair ?? "Moeda" };
}

export default async function CurrencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCurrency(id);
  if (!c) notFound();
  const item = getSummaryItem(id);
  const series = getSeries(id);
  const fc = getForecasts().forecasts[id];
  const user = await getCurrentUser();
  const watched = await isWatched(user?.id, "currency", id);
  const s = item?.stats;
  const commodities = getCatalog().instruments.filter((i) => i.dataMode === "real");
  const corr = commodities
    .map((i) => ({ i, c: correlationBetween(id, i.id) }))
    .filter((x) => x.c)
    .sort((a, b) => Math.abs(b.c!.r) - Math.abs(a.c!.r))
    .slice(0, 12);
  const links = linksForDriver(id);
  const year = String(new Date().getFullYear());
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Link href="/moedas">Moedas</Link>}
        accent="#38BDF8"
        title={<span className="flex items-center gap-3">{c.pair} <span className="text-base font-normal text-muted">{c.name.pt}</span> <DataBadge mode={c.dataMode} stale={s?.stale} /></span>}
        subtitle={c.description}
        right={c.dataMode !== "unavailable" ? <><WatchButton itemType="currency" itemRef={id} initial={watched} loggedIn={!!user} /><AlertLink itemType="currency" itemRef={id} /><AskAi question={`Como ${c.pair} se relaciona com commodities e o que explica o movimento recente?`} /></> : undefined}
      />
      {c.dataMode === "unavailable" ? (
        <Notice tone="gold" title="Série indisponível">{c.description} {c.commodityLink}</Notice>
      ) : (
        <>
          <Card>
            <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
              <Stat label={c.unitLabel} value={fmtNumber(s?.last, 4)} />
              <Stat label="Dia" value={<Change v={s?.changes.d1} digits={2} />} />
              <Stat label="Semana" value={<Change v={s?.changes.w1} />} />
              <Stat label="Mês" value={<Change v={s?.changes.m1} />} />
              <Stat label="12 meses" value={<Change v={s?.changes.y1} />} />
              <Stat label="No ano" value={<Change v={s?.changes.ytd} />} />
              <Stat label="Volatilidade anual." value={fmtPct(s?.volatility ?? null, 1, false)} sub="63 pregões" />
            </CardBody>
            <div className="border-t border-line px-4 py-2"><SourceLine source={item?.source} stats={s} frequency="daily" /></div>
          </Card>
          <Card>
            <CardHeader title="Histórico" subtitle="Fechamentos diários; velas semanais disponíveis" />
            {series && <PriceChart points={series.points} frequency="daily" unitLabel={c.unitLabel} />}
          </Card>
          {id === "usdbrl" && (
            <Notice tone="blue" title="Três referências diferentes para o dólar futuro">
              (1) <b>Previsão Avermont</b> (abaixo, estatística); (2) <b>expectativa de mercado</b> — mediana do Focus para o fim de {year}: R$ {fmtPrice(focusValue("Câmbio", year)?.Mediana)};
              (3) <b>cotação de contratos futuros de dólar (B3)</b> — exige licença de market data e não está integrada. Veja <Link href="/curvas-futuras" className="underline">Curvas Futuras</Link>.
            </Notice>
          )}
          <ForecastPanel fc={fc} history={series?.points ?? []} unitLabel={c.unitLabel} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Relação com commodities" subtitle="Correlação de retornos mensais (10 anos), ordenada por intensidade" />
              <CardBody className="p-0">
                <table className="fin-table w-full text-[13px]">
                  <thead><tr><th className="text-left">Commodity</th><th className="text-right">r</th><th className="text-right">IC 95%</th><th className="text-right">Faixa 36m</th></tr></thead>
                  <tbody>
                    {corr.map(({ i, c: cc }) => (
                      <tr key={i.id}>
                        <td><Link href={`/commodity/${i.id}`} className="hover:text-blue">{i.name.pt}</Link></td>
                        <td className={`num text-right font-semibold ${cc!.r > 0.3 ? "text-up" : cc!.r < -0.3 ? "text-down" : ""}`}>{fmtNumber(cc!.r, 2)}</td>
                        <td className="num text-right text-xs text-muted">{fmtNumber(cc!.ci[0], 2)} a {fmtNumber(cc!.ci[1], 2)}</td>
                        <td className="num text-right text-xs text-muted">{fmtNumber(cc!.rollingMin, 2)} a {fmtNumber(cc!.rollingMax, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[11px] text-muted">Cotação expressa como {c.unitLabel}. Correlação não implica causalidade; relações cambiais mudam com juros, risco fiscal e fluxos.</p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Relações econômicas" />
              <CardBody className="space-y-2 text-[13px] text-fg-2">
                <p>{c.commodityLink}</p>
                {links.map((l) => (
                  <div key={l.scenario} className="rounded-lg border border-line p-3">
                    <div className="mb-1 font-semibold text-fg">{l.scenario}</div>
                    <p>{l.explanation}</p>
                    <p className="mt-1 text-[11.5px] text-muted"><b>Contrapontos:</b> {l.counterfactors.join("; ")}. {l.limitations}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}
      <Disclaimer />
    </div>
  );
}
