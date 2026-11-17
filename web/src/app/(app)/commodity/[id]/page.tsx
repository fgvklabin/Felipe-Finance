import Link from "next/link";
import { notFound } from "next/navigation";
import { CloudSun, Factory, Globe2, Ship, Sprout, Swords } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader, Stat } from "@/components/ui";
import { Change, DataBadge, SourceLine } from "@/components/market/bits";
import { PriceChart } from "@/components/charts/PriceChart";
import { CompareChart } from "@/components/charts/CompareChart";
import { ForecastPanel } from "@/components/forecast/ForecastPanel";
import { AlertLink, WatchButton } from "@/components/WatchButton";
import { AskAi } from "@/components/ai/AskAi";
import { correlationBetween, getCatalog, getCategory, getForecasts, getInstrument, getSeries, getSummary, getSummaryItem } from "@/lib/market";
import { linksForDriver } from "@/lib/impact";
import { getCurrentUser } from "@/lib/auth";
import { isWatched } from "@/lib/watchlist";
import { fmtDate, fmtNumber, fmtPct, fmtPrice } from "@/lib/format";

const PRICE_TYPE: Record<string, string> = {
  international_benchmark: "Benchmark internacional",
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
  const catalog = getCatalog();
  const compareOptions = [
    ...catalog.instruments.map((i) => ({ id: i.id, label: i.name.pt, demo: i.dataMode === "demo" })),
    ...catalog.currencies.filter((c) => c.dataMode === "real").map((c) => ({ id: c.id, label: c.pair })),
  ];
  const corrTargets = [...new Set([...inst.related.currencies, "usdbrl", "dxy"])].filter((c) => c !== "usdclp");
  const peers = getSummary().items.filter((x) => x.category === inst.category && x.id !== id && x.dataMode === "real").slice(0, 8);
  const y1 = s?.changes.y1 ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Link href={`/mercados/${inst.category === "metais-preciosos" ? "metais" : inst.category}`}>{cat?.name.pt}</Link>}
        accent={cat?.color}
        title={<span className="flex flex-wrap items-center gap-3">{inst.name.pt} <DataBadge mode={inst.dataMode} stale={s?.stale} /></span>}
        subtitle={inst.benchmark}
        right={
          <>
            <Badge tone="blue">{inst.kind === "raw" ? "Matéria-prima" : "Material processado"}</Badge>
            <Badge tone="cyan">{PRICE_TYPE[inst.priceType]}</Badge>
            <WatchButton itemType="commodity" itemRef={id} initial={watched} loggedIn={!!user} />
            <AlertLink itemType="commodity" itemRef={id} />
          </>
        }
      />

      {demo && (
        <Notice tone="red" title="Série de DEMONSTRAÇÃO">
          Os valores abaixo são um índice sintético (base 100) para demonstrar a interface. Eles <b>não</b> representam preços de mercado. {inst.brazilRef}.
        </Notice>
      )}
      {s?.stale && !demo && (
        <Notice tone="gold" title="Dado desatualizado">
          Última observação publicada: {fmtDate(s.lastDate, "pt", { month: "long", year: "numeric", timeZone: "UTC" })}. A edição mais recente da fonte ainda não foi ingerida nesta implantação — veja <Link className="underline" href="/fontes">Fontes de Dados</Link>.
        </Notice>
      )}

      <Card>
        <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Stat label={`Preço (${unitLabel})`} value={fmtPrice(s?.last)} sub={inst.frequency === "monthly" ? `média de ${fmtDate(s?.lastDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}` : fmtDate(s?.lastDate)} />
          <Stat label="Mês" value={<Change v={s?.changes.m1} />} />
          <Stat label="3 meses" value={<Change v={s?.changes.m3} />} />
          <Stat label="12 meses" value={<Change v={s?.changes.y1} />} />
          <Stat label="No ano" value={<Change v={s?.changes.ytd} />} />
          <Stat label="Máx. 52 sem." value={fmtPrice(s?.high52w)} />
          <Stat label="Mín. 52 sem." value={fmtPrice(s?.low52w)} />
          <Stat label="Volatilidade anual." value={fmtPct(s?.volatility ?? null, 1, false)} sub={inst.frequency === "monthly" ? "24 meses" : "63 pregões"} />
        </CardBody>
        <div className="border-t border-line px-4 py-2"><SourceLine source={item?.source} stats={s} frequency={inst.frequency} /></div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Desempenho histórico" subtitle={`Desde ${fmtDate(s?.firstDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })} · ${s?.observations ?? 0} observações`} accent={cat?.color} />
          {series ? <PriceChart points={series.points} brlPoints={series.brlPoints} frequency={series.frequency} unitLabel={unitLabel} demo={demo} /> : <CardBody>Série indisponível.</CardBody>}
        </Card>
        <Card>
          <CardHeader title="Informações de mercado" />
          <CardBody className="space-y-3 text-[13px]">
            <div><div className="text-[11px] uppercase tracking-wide text-muted">Benchmark internacional</div><div className="text-fg-2">{inst.benchmark}</div></div>
            <div><div className="text-[11px] uppercase tracking-wide text-muted">Referência brasileira</div><div className="text-fg-2">{inst.brazilRef}</div></div>
            {!demo && lastBrl && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Conversão cambial</div>
                <div className="num text-fg">R$ {fmtPrice(lastBrl[1])} / {inst.unit}</div>
                <div className="text-[11px] text-muted">US$ × PTAX média de {fmtDate(lastBrl[0], "pt", { month: "short", year: "numeric", timeZone: "UTC" })}. Não é preço físico no Brasil (não inclui frete, prêmio, impostos).</div>
                {usd?.stats?.last && s?.last && <div className="num mt-1 text-[11px] text-muted">Pela PTAX atual (R$ {fmtPrice(usd.stats.last)}): R$ {fmtPrice(s.last * usd.stats.last)} / {inst.unit}</div>}
              </div>
            )}
            {inst.conversions.length > 0 && !demo && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Outras unidades</div>
                {inst.conversions.map((c) => <div key={c.label} className="num text-fg-2">{fmtPrice((s?.last ?? 0) * c.factor)} {c.label}</div>)}
              </div>
            )}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Especificações</div>
              <ul className="text-fg-2">
                <li>Unidade original: {unitLabel} · Moeda: {inst.currency}</li>
                <li>Frequência: {inst.frequency === "monthly" ? "mensal (média do mês)" : "diária"}</li>
                <li>Tipo: {inst.kind === "raw" ? "matéria-prima" : "processado"} · {PRICE_TYPE[inst.priceType]}</li>
                {series?.validation && <li>Validação: {series.validation.dropped} pontos descartados; {series.validation.warnings.length} variações extremas sinalizadas</li>}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Comparar commodities" subtitle="Adicione até 6 séries ao mesmo gráfico" />
        <CompareChart base={id} options={compareOptions} />
      </Card>

      <ForecastPanel fc={fc} history={series?.points ?? []} inst={inst} unitLabel={unitLabel} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por que o preço está se movendo?" subtitle="Explicação construída a partir dos dados e da base de fundamentos" accent="var(--purple)" right={<AskAi question={`Por que o preço de ${inst.name.pt} está ${y1 !== null && y1 >= 0 ? "subindo" : "caindo"}? Explique com dados e cite fontes.`} />} />
          <CardBody className="space-y-2 text-[13px] text-fg-2">
            {demo ? (
              <p>Série demonstrativa: não há movimento de preço real para explicar.</p>
            ) : (
              <>
                <p>
                  Em 12 meses, o benchmark variou <b className={y1 !== null && y1 >= 0 ? "text-up" : "text-down"}>{fmtPct(y1)}</b>; no último mês publicado, <b>{fmtPct(s?.changes.m1)}</b>.
                  {fc?.signals?.volRecent && fc.signals.volLongRun ? ` A volatilidade recente (${fmtPct(fc.signals.volRecent, 0, false)}) está ${fc.signals.volRecent > fc.signals.volLongRun * 1.2 ? "acima" : fc.signals.volRecent < fc.signals.volLongRun * 0.8 ? "abaixo" : "próxima"} da média de 5 anos (${fmtPct(fc.signals.volLongRun, 0, false)}).` : ""}
                </p>
                <p>Fatores que costumam explicar movimentos neste mercado: {inst.fundamentals.drivers.slice(0, 4).join("; ").toLowerCase()}.</p>
                {(() => {
                  const c = correlationBetween(id, "usdbrl");
                  return c ? <p>Correlação histórica dos retornos mensais com o dólar/real (10 anos): <b>{fmtNumber(c.r, 2)}</b> (IC 95%: {fmtNumber(c.ci[0], 2)} a {fmtNumber(c.ci[1], 2)}; n={c.n}); em janelas de 36 meses variou de {fmtNumber(c.rollingMin, 2)} a {fmtNumber(c.rollingMax, 2)} — relação instável, e correlação não implica causalidade.</p> : null;
                })()}
                <p className="text-[11.5px] text-muted">Esta explicação não identifica causas específicas de um evento; para isso, consulte notícias com fonte. Use o botão para pedir à Avermont AI uma análise com fontes.</p>
              </>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Análise fundamental" subtitle="Qualitativa · dados quantitativos de oferta e demanda (USDA PSD, Conab) entram na fase 2" />
          <CardBody className="grid gap-3 text-[12.5px] sm:grid-cols-2">
            {[
              { icon: Factory, title: "Principais produtores", body: inst.fundamentals.producers.join(", ") },
              { icon: Globe2, title: "Principais consumidores", body: inst.fundamentals.consumers.join(", ") },
              { icon: Sprout, title: "Sazonalidade", body: inst.fundamentals.seasonality },
              { icon: CloudSun, title: "Clima", body: inst.fundamentals.weather },
              { icon: Ship, title: "Transporte e logística", body: inst.fundamentals.logistics },
              { icon: Swords, title: "Riscos geopolíticos", body: inst.fundamentals.geopolitics },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-line p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Icon size={13} /> {title}</div>
                <div className="text-fg-2">{body}</div>
              </div>
            ))}
            <div className="sm:col-span-2 text-[11px] text-muted">
              Produção, consumo, estoques e comércio exterior quantitativos: integração planejada com USDA PSD/WASDE, Conab, Comex Stat e FAOSTAT (ver <Link href="/fontes" className="underline">Fontes</Link>). Não exibimos números sem fonte integrada.
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Impact Engine — quem ganha e quem perde" subtitle="Efeitos de primeira ordem de uma ALTA de preço" right={<Link href="/impacto" className="text-xs text-blue hover:underline">Mapa de relações →</Link>} />
          <CardBody className="space-y-3">
            {impact.length === 0 && <p className="text-sm text-muted">Sem relações catalogadas ainda para este mercado.</p>}
            {impact.map((l) => (
              <div key={l.scenario} className="space-y-2">
                <p className="text-[12.5px] text-fg-2">{l.explanation}</p>
                <ul className="space-y-1">
                  {l.effects.map((e) => (
                    <li key={e.target} className="flex items-start gap-2 text-[12.5px]">
                      <Badge tone={e.direction === "positive" ? "green" : e.direction === "negative" ? "red" : "gold"}>{e.direction === "positive" ? "Positivo" : e.direction === "negative" ? "Negativo" : "Misto"}</Badge>
                      <span>{e.ref ? <Link href={`/invest/empresas/${e.ref}`} className="font-medium hover:text-blue">{e.target}</Link> : <span className="font-medium">{e.target}</span>} — <span className="text-muted">{e.channel}</span></span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11.5px] text-muted"><b>Contrapontos:</b> {l.counterfactors.join("; ")}. <b>Incerteza:</b> {l.uncertainty}. {l.limitations}</p>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Moedas e mercados relacionados" subtitle="Correlação de retornos mensais (10 anos) · Pearson com IC 95%" />
          <CardBody className="p-0">
            <table className="fin-table w-full text-[13px]">
              <thead><tr><th className="text-left">Série</th><th className="text-right">r</th><th className="text-right">IC 95%</th><th className="text-right">Faixa em 36m</th><th className="text-right">n</th></tr></thead>
              <tbody>
                {[...corrTargets, ...peers.map((p) => p.id)].map((other) => {
                  const c = correlationBetween(id, other);
                  const name = getSummaryItem(other)?.name.pt ?? other;
                  return (
                    <tr key={other}>
                      <td><Link href={getSummaryItem(other)?.type === "currency" ? `/moedas/${other}` : `/commodity/${other}`} className="hover:text-blue">{name}</Link></td>
                      {c ? (
                        <>
                          <td className={`num text-right font-semibold ${c.r > 0.3 ? "text-up" : c.r < -0.3 ? "text-down" : ""}`}>{fmtNumber(c.r, 2)}</td>
                          <td className="num text-right text-xs text-muted">{fmtNumber(c.ci[0], 2)} a {fmtNumber(c.ci[1], 2)}</td>
                          <td className="num text-right text-xs text-muted">{fmtNumber(c.rollingMin, 2)} a {fmtNumber(c.rollingMax, 2)}</td>
                          <td className="num text-right text-xs text-muted">{c.n}</td>
                        </>
                      ) : <td colSpan={4} className="text-right text-xs text-muted">sem dados suficientes</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-muted">Correlação não implica causalidade. A coluna “faixa em 36m” mostra a instabilidade da relação ao longo do tempo.</p>
          </CardBody>
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
