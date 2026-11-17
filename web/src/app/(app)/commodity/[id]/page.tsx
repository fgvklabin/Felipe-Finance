import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Details, Disclaimer, Notice, PageHeader, Summary } from "@/components/ui";
import { Change, DataBadge, SourceLine } from "@/components/market/bits";
import { PriceChart } from "@/components/charts/PriceChart";
import { CompareChart } from "@/components/charts/CompareChart";
import { ForecastPanel } from "@/components/forecast/ForecastPanel";
import { AlertLink, WatchButton } from "@/components/WatchButton";
import { AskAi } from "@/components/ai/AskAi";
import { correlationBetween, getCatalog, getCategory, getForecasts, getInstrument, getSeries, getSummary, getSummaryItem } from "@/lib/market";
import { linksForDriver } from "@/lib/impact";
import { fundsFor, stocksFor } from "@/lib/beneficiaries";
import { getCurrentUser } from "@/lib/auth";
import { isWatched } from "@/lib/watchlist";
import { forecastSentence, storyFor } from "@/lib/plain";
import { fmtDate, fmtNumber, fmtPct, fmtPrice } from "@/lib/format";

const PRICE_TYPE: Record<string, string> = {
  international_benchmark: "Preço internacional de referência",
  regional_physical: "Preço físico regional",
  futures: "Contrato futuro",
  index: "Índice",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = getInstrument(id);
  return { title: i ? i.name.pt : "Commodity" };
}

export default async function CommodityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inst = getInstrument(id);
  if (!inst) notFound();
  const item = getSummaryItem(id);
  const series = getSeries(id);
  const cat = getCategory(inst.category);
  const user = await getCurrentUser();
  const watched = await isWatched(user?.id, "commodity", id);
  const fc = getForecasts().forecasts[id];
  const s = item?.stats;
  const usd = getSummaryItem("usdbrl");
  const unitLabel = item?.unitLabel ?? inst.unit;
  const demo = inst.dataMode === "demo";
  const lastBrl = series?.brlPoints?.[series.brlPoints.length - 1];
  const impact = linksForDriver(id);
  const stocks = stocksFor(id);
  const funds = fundsFor(id).filter((f) => f.basis !== "nao_verificada");
  const catalog = getCatalog();
  const compareOptions = [
    ...catalog.instruments.map((i) => ({ id: i.id, label: i.name.pt, demo: i.dataMode === "demo" })),
    ...catalog.currencies.filter((c) => c.dataMode === "real").map((c) => ({ id: c.id, label: c.pair })),
  ];
  const corrTargets = [...new Set([...inst.related.currencies, "usdbrl", "dxy"])].filter((c) => c !== "usdclp");
  const peers = getSummary().items.filter((x) => x.category === inst.category && x.id !== id && x.dataMode === "real").slice(0, 6);
  const story = item && !demo ? storyFor(item, fc, inst.fundamentals.drivers) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Link href={`/mercados/${inst.category === "metais-preciosos" ? "metais" : inst.category}`}>{cat?.name.pt}</Link>}
        accent={cat?.color}
        title={<span className="flex flex-wrap items-center gap-3">{inst.name.pt} <DataBadge mode={inst.dataMode} stale={s?.stale} /></span>}
        right={<><WatchButton itemType="commodity" itemRef={id} initial={watched} loggedIn={!!user} /><AlertLink itemType="commodity" itemRef={id} /><AskAi question={`Explique de forma simples o que está acontecendo com o preço de ${inst.name.pt}.`} label="Explicar com IA" /></>}
      />

      {demo && <Notice tone="red">Esta commodity ainda não tem preço real licenciado. Os números abaixo são <b>apenas demonstração</b>.</Notice>}

      {/* 1. O essencial */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Preço {inst.frequency === "monthly" ? `médio de ${fmtDate(s?.lastDate, "pt", { month: "long", year: "numeric", timeZone: "UTC" })}` : `em ${fmtDate(s?.lastDate)}`}</div>
          <div className="num mt-1 text-4xl font-semibold">{fmtPrice(s?.last)}</div>
          <div className="text-sm text-muted">{unitLabel}</div>
          {!demo && lastBrl && usd?.stats?.last && s?.last && <div className="num mt-1 text-sm text-fg-2">≈ R$ {fmtPrice(s.last * usd.stats.last)} / {inst.unit} <span className="text-xs text-muted">(dólar de hoje)</span></div>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-panel-2 p-2"><div className="text-[11px] text-muted">1 mês</div><Change v={s?.changes.m1} className="font-semibold" /></div>
            <div className="rounded-lg bg-panel-2 p-2"><div className="text-[11px] text-muted">12 meses</div><Change v={s?.changes.y1} className="font-semibold" /></div>
            <div className="rounded-lg bg-panel-2 p-2"><div className="text-[11px] text-muted">No ano</div><Change v={s?.changes.ytd} className="font-semibold" /></div>
          </div>
        </Card>
        {story.length > 0 ? <Summary items={story} /> : <Summary items={["Esta é uma série de demonstração: não há movimento real de preço para explicar.", forecastSentence(undefined)]} />}
      </div>

      {/* 2. Gráfico */}
      <Card>
        <CardHeader title="Histórico de preço" accent={cat?.color} />
        {series ? <PriceChart points={series.points} brlPoints={series.brlPoints} frequency={series.frequency} unitLabel={unitLabel} demo={demo} /> : <CardBody>Série indisponível.</CardBody>}
        <div className="border-t border-line px-4 py-2"><SourceLine source={item?.source} stats={s} frequency={inst.frequency} /></div>
      </Card>

      {/* 3. Quem ganha com a alta */}
      <Card>
        <CardHeader title="Quem pode ganhar se o preço subir" subtitle="Empresas e fundos ligados a esta commodity" accent="var(--brand)" right={<Link href={`/beneficiarios?c=${id}`} className="inline-flex items-center gap-1 text-xs text-blue hover:underline">Ver tudo <ArrowRight size={12} /></Link>} />
        <CardBody>
          {stocks.length === 0 && funds.length === 0 ? <p className="text-sm text-muted">Nenhuma empresa ou fundo mapeado para esta commodity ainda.</p> : (
            <div className="flex flex-wrap gap-2">
              {stocks.map((st) => (
                <Link key={st.ticker} href={`/empresas/${st.ticker}`} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-blue">
                  <span className="font-semibold text-blue">{st.tickers.join("/")}</span> <span className="text-fg-2">{st.name}</span>
                  {st.strength === "mista" && <span className="ml-1 text-[11px] text-gold">(efeito misto)</span>}
                </Link>
              ))}
              {funds.slice(0, 6).map((f) => (
                <Link key={f.fund.cnpjDigits} href={`/fundos/${f.fund.cnpjDigits}`} className="max-w-[320px] truncate rounded-lg border border-line px-3 py-2 text-sm hover:border-gold" title={f.fund.name}>
                  <Badge tone={f.basis === "direta" ? "green" : "blue"}>{f.basis === "direta" ? "fundo de índice" : "fundo de ações"}</Badge> <span className="text-fg-2">{f.fund.name}</span>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Preço da commodity subindo não garante alta da ação ou do fundo.</p>
        </CardBody>
      </Card>

      {/* 4. Detalhes para quem quer se aprofundar */}
      <Details title="Previsão em detalhe (modelos, cenários e testes)">
        <ForecastPanel fc={fc} history={series?.points ?? []} inst={inst} unitLabel={unitLabel} />
      </Details>

      <Details title="Comparar com outras commodities">
        <CompareChart base={id} options={compareOptions} />
      </Details>

      <Details title="Sobre este mercado (produtores, clima, logística, especificações)">
        <div className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div><b>Referência de preço:</b> {inst.benchmark} <Badge tone="cyan">{PRICE_TYPE[inst.priceType]}</Badge></div>
          <div><b>Referência no Brasil:</b> {inst.brazilRef}</div>
          <div><b>Quem mais produz:</b> {inst.fundamentals.producers.join(", ")}</div>
          <div><b>Quem mais consome:</b> {inst.fundamentals.consumers.join(", ")}</div>
          <div><b>Época do ano:</b> {inst.fundamentals.seasonality}</div>
          <div><b>Clima:</b> {inst.fundamentals.weather}</div>
          <div><b>Transporte:</b> {inst.fundamentals.logistics}</div>
          <div><b>Riscos geopolíticos:</b> {inst.fundamentals.geopolitics}</div>
          {!demo && inst.conversions.length > 0 && <div><b>Outras unidades:</b> {inst.conversions.map((c) => `${fmtPrice((s?.last ?? 0) * c.factor)} ${c.label}`).join(" · ")}</div>}
          {!demo && lastBrl && <div><b>Em reais (média do mês):</b> R$ {fmtPrice(lastBrl[1])} / {inst.unit} — preço internacional × dólar, não é preço físico no Brasil.</div>}
          <div className="text-xs text-muted sm:col-span-2">Volatilidade anualizada {fmtPct(s?.volatility ?? null, 1, false)} · máx./mín. 12 meses {fmtPrice(s?.high52w)} / {fmtPrice(s?.low52w)} · {s?.observations} observações desde {fmtDate(s?.firstDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}{series?.validation ? ` · validação: ${series.validation.dropped} pontos descartados` : ""}</div>
        </div>
      </Details>

      {impact.length > 0 && (
        <Details title="Efeitos na economia (quem ganha e quem perde)">
          {impact.map((l) => (
            <div key={l.scenario} className="space-y-2 text-[13px]">
              <p className="text-fg-2">{l.explanation}</p>
              <ul className="space-y-1">
                {l.effects.map((e) => (
                  <li key={e.target} className="flex items-start gap-2">
                    <Badge tone={e.direction === "positive" ? "green" : e.direction === "negative" ? "red" : "gold"}>{e.direction === "positive" ? "ganha" : e.direction === "negative" ? "perde" : "misto"}</Badge>
                    <span>{e.ref ? <Link href={`/empresas/${e.ref}`} className="font-medium hover:text-blue">{e.target}</Link> : <span className="font-medium">{e.target}</span>} — <span className="text-muted">{e.channel}</span></span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Pode não acontecer porque: {l.counterfactors.join("; ")}.</p>
            </div>
          ))}
        </Details>
      )}

      <Details title="Relação com dólar e outros mercados (correlações)">
        <table className="fin-table w-full text-[13px]">
          <thead><tr><th className="text-left">Série</th><th className="text-right">Correlação</th><th className="text-right">IC 95%</th><th className="text-right">Variação em 36m</th></tr></thead>
          <tbody>
            {[...corrTargets, ...peers.map((p) => p.id)].map((other) => {
              const c = correlationBetween(id, other);
              const name = getSummaryItem(other)?.name.pt ?? other;
              return (
                <tr key={other}>
                  <td>{name}</td>
                  {c ? <><td className="num text-right font-semibold">{fmtNumber(c.r, 2)}</td><td className="num text-right text-xs text-muted">{fmtNumber(c.ci[0], 2)} a {fmtNumber(c.ci[1], 2)}</td><td className="num text-right text-xs text-muted">{fmtNumber(c.rollingMin, 2)} a {fmtNumber(c.rollingMax, 2)}</td></> : <td colSpan={3} className="text-right text-xs text-muted">sem dados</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted">Retornos mensais dos últimos 10 anos. Correlação não significa que uma coisa causa a outra.</p>
      </Details>
      <Disclaimer />
    </div>
  );
}
