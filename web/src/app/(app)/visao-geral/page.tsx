import Link from "next/link";
import { CalendarDays, Newspaper, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, Disclaimer, PageHeader, Stat } from "@/components/ui";
import { Change, ChangePill, DataBadge } from "@/components/market/bits";
import { Heatmap } from "@/components/market/Heatmap";
import { MarketTable } from "@/components/market/MarketTable";
import { TickerTape } from "@/components/market/TickerTape";
import { Markdown } from "@/components/ai/Markdown";
import { getCatalog, getForecasts, getSummary, visibleItems } from "@/lib/market";
import { toRows } from "@/lib/rows";
import { getPrefs } from "@/lib/prefs";
import { dailySummary, latestMacro, marketNotes } from "@/lib/insights";
import { upcomingEvents } from "@/lib/calendar";
import { fmtDate, fmtDateTime, fmtNumber, fmtPct, fmtPrice, fmtTarget } from "@/lib/format";

export const metadata = { title: "Visão Geral" };

export default async function OverviewPage() {
  const prefs = await getPrefs();
  const cat = getCatalog();
  const rows = toRows(visibleItems(prefs.dataMode), cat, prefs.locale);
  const fxRows = rows.filter((r) => r.type === "currency");
  const commodityRows = rows.filter((r) => r.type === "instrument");
  const realCommodities = commodityRows.filter((r) => r.dataMode === "real" && r.y1 !== null);
  const ranked = [...realCommodities].sort((a, b) => (b.y1 ?? 0) - (a.y1 ?? 0));
  const tickerRows = [...fxRows, ...commodityRows.filter((r) => ["brent", "ouro", "soja", "minerio-ferro", "cobre", "cafe-arabica", "acucar", "milho"].includes(r.id))];
  const macro = latestMacro();
  const summary = dailySummary();
  const notes = marketNotes().slice(0, 4);
  const events = upcomingEvents(5);
  const fc = getForecasts();
  const usd = fxRows.find((r) => r.id === "usdbrl");
  const eur = fxRows.find((r) => r.id === "eurbrl");
  const dxy = fxRows.find((r) => r.id === "dxy");
  const brent = commodityRows.find((r) => r.id === "brent");
  const volRank = [...rows.filter((r) => r.dataMode === "real" && r.volatility !== null)].sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0)).slice(0, 8);
  const fxForecasts = ["usdbrl", "eurbrl", "dxy"].map((id) => ({ id, f: fc.forecasts[id]?.horizons["30d"] })).filter((x) => x.f?.status === "ok");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Markets"
        title="Visão geral"
        subtitle="O que está acontecendo com commodities, dólar e economia — em poucos minutos."
        right={<span className="text-xs text-muted">Snapshot gerado em {fmtDateTime(getSummary().generatedAt)}</span>}
      />
      <TickerTape rows={tickerRows} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Dólar PTAX", row: usd, prefix: "R$ " },
          { label: "Euro PTAX", row: eur, prefix: "R$ " },
          { label: "Índice do dólar (réplica)", row: dxy, prefix: "" },
        ].map(({ label, row, prefix }) => (
          <Card key={label} className="p-3">
            {row ? (
              <Link href={row.href}>
                <Stat label={label} value={`${prefix}${fmtPrice(row.last)}`} sub={<><Change v={row.d1} digits={2} /> dia · {fmtDate(row.lastDate)}</>} />
              </Link>
            ) : <Stat label={label} value="—" />}
          </Card>
        ))}
        <Card className="p-3"><Stat label="Selic (meta)" value={macro.selic ? `${fmtNumber(macro.selic.value, 2)}%` : "—"} sub={macro.selic ? `BCB · ${fmtDate(macro.selic.date)}` : "indisponível"} /></Card>
        <Card className="p-3"><Stat label="IPCA 12 meses" value={macro.ipca12 ? `${fmtNumber(macro.ipca12.value, 2)}%` : "—"} sub={macro.ipca12 ? `IBGE · ${fmtDate(macro.ipca12.date, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}` : "indisponível"} /></Card>
        <Card className="p-3">
          {brent ? (
            <Link href={brent.href}>
              <Stat label="Petróleo Brent" value={`US$ ${fmtPrice(brent.last)}`} sub={<><Change v={brent.m1} /> m/m · {fmtDate(brent.lastDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}</>} />
            </Link>
          ) : <Stat label="Brent" value="—" />}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={<span className="flex items-center gap-2"><Sparkles size={15} className="text-purple" /> Hoje em 1 minuto</span>}
            subtitle="Resumo automático dos dados oficiais"
            accent="var(--purple)"
          />
          <CardBody>
            <ul className="space-y-2">
              {summary.bullets.map((b, i) => (
                <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple" /><Markdown text={b} /></li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="O que o mercado espera" subtitle={macro.focus ? `Pesquisa Focus do Banco Central · ${fmtDate(macro.focus.date)}` : "indisponível"} accent="var(--cyan)" />
          <CardBody className="p-0">
            <table className="fin-table w-full text-[13px]">
              <thead><tr><th className="text-left">Indicador</th>{["2026", "2027", "2028"].map((y) => <th key={y} className="text-right">{y}</th>)}</tr></thead>
              <tbody>
                {["IPCA", "Selic", "Câmbio", "PIB Total"].map((ind) => (
                  <tr key={ind}>
                    <td className="text-fg-2">{ind === "PIB Total" ? "PIB (%)" : ind === "Câmbio" ? "Câmbio (R$/US$)" : `${ind} (%)`}</td>
                    {["2026", "2027", "2028"].map((y) => {
                      const it = macro.focus?.items.find((i) => i.Indicador === ind && i.DataReferencia === y);
                      return <td key={y} className="num text-right">{it ? fmtNumber(it.Mediana, 2) : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-muted">Mediana das projeções de economistas.</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Quem subiu e quem caiu" subtitle="Verde subiu, vermelho caiu. Clique para ver detalhes." accent="var(--blue)" />
        <CardBody><Heatmap rows={commodityRows} /></CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {[
          { title: "Mais subiram em 12 meses", list: ranked.slice(0, 6) },
          { title: "Mais caíram em 12 meses", list: ranked.slice(-6).reverse() },
        ].map(({ title, list }) => (
          <Card key={title}>
            <CardHeader title={title} />
            <ul className="divide-y divide-line">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-panel-2">
                    <span className="h-5 w-1 rounded-full" style={{ background: r.color }} />
                    <span className="truncate">{r.name}</span>
                    <DataBadge mode="real" stale={r.stale} />
                    <span className="ml-auto"><ChangePill v={r.y1} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <Card>
          <CardHeader title="Os mais instáveis" subtitle="Quanto o preço costuma oscilar em um ano" />
          <ul className="divide-y divide-line">
            {volRank.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="h-5 w-1 rounded-full" style={{ background: r.color }} />
                <Link href={r.href} className="truncate hover:text-blue">{r.name}</Link>
                <span className="ml-auto flex items-center gap-2">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-panel-2"><span className="block h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (r.volatility ?? 0) * 150)}%` }} /></span>
                  <span className="num w-14 text-right text-xs text-fg-2">{fmtPct(r.volatility, 1, false)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Todos os preços" subtitle="Clique no nome para ver o painel completo" right={<Link href="/mercados" className="text-xs text-blue hover:underline">Ver mercados →</Link>} />
        <MarketTable rows={rows} compact />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-brand" /> Dólar e euro no próximo mês</span>} subtitle="Faixa provável segundo os modelos" right={<Link href="/previsoes" className="text-xs text-blue hover:underline">Previsões →</Link>} />
          <CardBody className="space-y-3">
            {fxForecasts.length === 0 && <p className="text-sm text-muted">Dados insuficientes para uma previsão confiável.</p>}
            {fxForecasts.map(({ id, f }) => (
              <div key={id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between text-sm">
                  <Link href={`/moedas/${id}`} className="font-medium hover:text-blue">{fxRows.find((r) => r.id === id)?.name}</Link>
                  <span className="text-[11px] text-muted">alvo {fmtTarget(f!.targetDate, "daily")}</span>
                </div>
                <div className="num mt-1 text-lg font-semibold">{fmtPrice(f!.central)}</div>
                <div className="num text-xs text-muted">provavelmente entre {fmtPrice(f!.low)} e {fmtPrice(f!.high)}</div>
                {!f!.beatsBaseline && <div className="mt-1 text-[11px] text-muted">Sem tendência clara: a melhor estimativa é o valor atual.</div>}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Newspaper size={15} className="text-blue" /> Destaques</span>} subtitle="E por que isso importa" right={<Link href="/noticias" className="text-xs text-blue hover:underline">Ver todos →</Link>} />
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-2.5">
                <Link href={`/noticias#${n.id}`} className="text-sm font-medium hover:text-blue">{n.title}</Link>
                <div className="mt-0.5 text-[11px] text-muted">{n.source.label} · {fmtDate(n.date)}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><CalendarDays size={15} className="text-gold" /> Agenda</span>} right={<Link href="/calendario" className="text-xs text-blue hover:underline">Calendário →</Link>} />
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className="num w-20 shrink-0 text-xs text-muted">{fmtDate(e.date)}</span>
                <span className="min-w-0"><span className="block truncate">{e.title}</span><span className="text-[11px] text-muted">{e.source}{e.confirmed ? "" : " · data estimada"}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-muted">Dados oficiais: Banco Mundial, Banco Central do Brasil, Banco Central Europeu e CVM. Itens marcados como DEMO são apenas demonstração. <Link href="/fontes" className="underline">Ver fontes</Link>.</p>
      <Disclaimer />
    </div>
  );
}
