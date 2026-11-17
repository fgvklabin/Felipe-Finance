import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader, Stat } from "@/components/ui";
import { Change } from "@/components/market/bits";
import { CompanyScenario } from "@/components/invest/CompanyScenario";
import { FinancialsChart } from "@/components/invest/FinancialsChart";
import { WatchButton, AlertLink } from "@/components/WatchButton";
import { AskAi } from "@/components/ai/AskAi";
import { findCompany, getCompanies, getSeries, getSummaryItem, type CompanyQuarter } from "@/lib/market";
import { quarterAverage, quarterLabel, quarterStory } from "@/lib/quarters";
import { kbFor } from "@/lib/companies-kb";
import { linksForTicker } from "@/lib/impact";
import { getCurrentUser } from "@/lib/auth";
import { isWatched } from "@/lib/watchlist";
import { fmtCompact, fmtDate, fmtNumber, fmtPct, fmtPrice } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const c = findCompany(ticker);
  if (!c) notFound();
  const kb = kbFor(ticker);
  const user = await getCurrentUser();
  const watched = await isWatched(user?.id, "company", ticker);
  const fin = c.financials;
  const last = fin[fin.length - 1];
  const prev = fin[fin.length - 2];
  const links = linksForTicker(ticker);
  const cvm = getCompanies();
  const lev = last?.netDebt !== undefined && last?.ebitdaCalculated ? last.netDebt / last.ebitdaCalculated : null;
  const rows: [string, keyof typeof last, boolean?][] = [
    ["Receita líquida", "revenue"], ["Lucro bruto", "grossProfit"], ["EBIT", "ebit"], ["D&A (DFC)", "depreciationAmortization"], ["EBITDA calculado", "ebitdaCalculated"],
    ["Resultado financeiro", "financialResult"], ["Lucro líquido", "netIncome"], ["Caixa + aplicações", "cash"], ["Dívida bruta", "grossDebt"], ["Dívida líquida", "netDebt"], ["Patrimônio líquido", "equity"], ["Ativo total", "totalAssets"],
    ["Margem bruta", "grossProfitMargin", true], ["Margem EBIT", "ebitMargin", true], ["Margem EBITDA calc.", "ebitdaCalculatedMargin", true], ["Margem líquida", "netIncomeMargin", true],
  ];
  const quarters = c.quarters ?? [];
  // Commodity principal com preço real, para comparar com a receita de cada trimestre
  const mainId = kb?.commodityExposure.find((e) => e.direction === "receita" && getSummaryItem(e.commodity)?.dataMode === "real")?.commodity;
  const mainSeries = mainId ? getSeries(mainId) : null;
  const mainName = mainId ? getSummaryItem(mainId)?.name.pt ?? mainId : null;
  const avgPrice = (end: string) => (mainSeries ? quarterAverage(mainSeries.points, end, mainSeries.frequency) : null);
  const priceYoY = (q: CompanyQuarter) => {
    const now = avgPrice(q.end), before = avgPrice(`${Number(q.end.slice(0, 4)) - 1}${q.end.slice(4)}`);
    return now !== null && before ? now / before - 1 : null;
  };
  const lastQ = quarters.at(-1);
  const story = lastQ ? quarterStory(lastQ, mainName ? { name: mainName.charAt(0).toLowerCase() + mainName.slice(1), change: priceYoY(lastQ) } : null) : [];
  const commodityOptions = (kb?.commodityExposure ?? []).map((e) => ({ id: e.commodity, label: getSummaryItem(e.commodity)?.name.pt ?? e.commodity }));
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Link href="/beneficiarios">Ações e fundos beneficiados</Link>}
        accent="var(--blue)"
        title={<span className="flex flex-wrap items-center gap-3">{c.tickersGiven.join(" / ")} <span className="text-lg font-normal text-fg-2">{c.name}</span></span>}
        subtitle={c.activityDescription ?? undefined}
        right={<><WatchButton itemType="company" itemRef={ticker} initial={watched} loggedIn={!!user} /><AlertLink itemType="company" itemRef={ticker} /><AskAi question={`Como mudanças em commodities e no dólar podem afetar ${kb?.shortName ?? c.name}? Use os dados da CVM e cite fontes.`} /></>}
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="green">CVM: {c.registrationStatus}</Badge>
        <Badge>{c.sector}</Badge>
        <Badge>CNPJ {c.cnpj}</Badge>
        <Badge>Código CVM {c.cvmCode}</Badge>
        {c.tickersMismatch.length > 0 ? <Badge tone="gold">Ticker {c.tickersMismatch.join(", ")} não confirmado no FCA</Badge> : <Badge tone="green">Ticker confirmado no FCA</Badge>}
        {c.website && <a className="text-blue underline" href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer">{c.website}</a>}
      </div>
      {c.tickersMismatch.length > 0 && (
        <Notice tone="gold">O formulário cadastral (FCA) desta companhia na CVM não traz o código de negociação {c.tickersMismatch.join(", ")} (o registro oficial apresenta outro valor). Mantemos o ticker como informado, sinalizado até a correção na fonte.</Notice>
      )}
      <Notice tone="gold" title="Cotação, valor de mercado e múltiplos indisponíveis">Exigem licença de market data (B3 ou provedor autorizado). Correlação histórica entre a ação e commodities será calculada quando houver cotações licenciadas.</Notice>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card className="p-3"><Stat label={`Receita ${last?.fiscalYear}`} value={fmtCompact(last?.revenue)} sub={<Change v={prev?.revenue && last?.revenue ? last.revenue / prev.revenue - 1 : null} />} /></Card>
        <Card className="p-3"><Stat label="EBITDA calc." value={fmtCompact(last?.ebitdaCalculated)} sub={`margem ${fmtPct(last?.ebitdaCalculatedMargin ?? null, 1, false)}`} /></Card>
        <Card className="p-3"><Stat label="Lucro líquido" value={fmtCompact(last?.netIncome)} sub={`margem ${fmtPct(last?.netIncomeMargin ?? null, 1, false)}`} /></Card>
        <Card className="p-3"><Stat label="Dívida líquida" value={fmtCompact(last?.netDebt)} /></Card>
        <Card className="p-3"><Stat label="Dív. líq./EBITDA calc." value={lev !== null ? `${fmtNumber(lev, 2)}x` : "—"} /></Card>
        <Card className="p-3"><Stat label="Patrimônio líquido" value={fmtCompact(last?.equity)} /></Card>
      </div>

      {lastQ && (
        <Card>
          <CardHeader title="Resultados por trimestre" subtitle={`CVM — Informações Trimestrais (ITR) · último: ${quarterLabel(lastQ.period)}`} accent="var(--brand)" />
          <CardBody className="space-y-3">
            <ul className="space-y-1 text-[14.5px] leading-relaxed">{story.map((s) => <li key={s} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{s}</li>)}</ul>
            <FinancialsChart data={quarters.map((q) => ({ label: quarterLabel(q.period), revenue: q.revenue, ebitda: q.ebitdaCalculated ?? 0, net: q.netIncome ?? 0 }))} height={220} />
            <div className="overflow-x-auto">
              <table className="fin-table w-full min-w-[640px] whitespace-nowrap text-[12.5px]">
                <thead>
                  <tr>
                    <th className="text-left">Trimestre</th><th className="text-right">Receita</th><th className="text-right">vs. 1 ano antes</th><th className="text-right">EBITDA calc. (margem)</th><th className="text-right">Lucro líquido</th><th className="text-right">Dívida líquida</th>
                    {mainName && <th className="text-right">{mainName}: preço médio (vs. 1 ano)</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...quarters].reverse().map((q) => {
                    const p = avgPrice(q.end), py = priceYoY(q);
                    return (
                      <tr key={q.period}>
                        <td className="font-medium">{quarterLabel(q.period)}{q.source !== "ITR" && <span className="ml-1 text-[10.5px] text-muted" title="Último trimestre do exercício: anual (DFP) menos 9 meses (ITR)">calc.</span>}</td>
                        <td className="num text-right">{fmtCompact(q.revenue)}</td>
                        <td className="text-right"><Change v={q.revenueYoY ?? null} /></td>
                        <td className="num text-right">{fmtCompact(q.ebitdaCalculated ?? null)} <span className="text-[11px] text-muted">{fmtPct(q.ebitdaCalculatedMargin ?? null, 0, false)}</span></td>
                        <td className={`num text-right ${q.netIncome !== undefined && q.netIncome < 0 ? "text-down" : ""}`}>{fmtCompact(q.netIncome ?? null)}</td>
                        <td className="num text-right">{fmtCompact(q.netDebt ?? null)}</td>
                        {mainName && <td className="num text-right">{p !== null ? fmtPrice(p) : "—"} {py !== null && <Change v={py} />}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted">
              Fonte: CVM — ITR (consolidado), versão mais recente; o último trimestre de cada exercício (&quot;calc.&quot;) é o anual (DFP) menos 9 meses. EBITDA calculado = EBIT + D&amp;A da DFC, não é o EBITDA ajustado da companhia.
              {mainName && ` Preço médio de ${mainName} no trimestre: World Bank Pink Sheet (${getSummaryItem(mainId!)?.unitLabel ?? mainSeries?.unit ?? ""}). Receita e preço andarem juntos não prova causa: volumes, câmbio e contratos também pesam.`}
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Demonstrações financeiras (consolidadas)" subtitle={`CVM DFP · referência FCA ${fmtDate(c.fcaReferenceDate)} · dados coletados em ${fmtDate(cvm.ingestedAt)}`} />
          <FinancialsChart data={fin.map((f) => ({ label: f.fiscalYear, revenue: f.revenue ?? 0, ebitda: f.ebitdaCalculated ?? 0, net: f.netIncome ?? 0 }))} />
          <div className="overflow-x-auto">
            <table className="fin-table w-full min-w-[640px] text-[12.5px]">
              <thead><tr><th className="text-left">R$</th>{fin.map((f) => <th key={f.fiscalYear} className="text-right">{f.fiscalYear}</th>)}</tr></thead>
              <tbody>
                {rows.map(([label, key, pct]) => (
                  <tr key={label}><td className="text-fg-2">{label}</td>{fin.map((f) => <td key={f.fiscalYear} className="num text-right">{pct ? fmtPct((f[key] as number) ?? null, 1, false) : fmtCompact((f[key] as number) ?? null, "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-muted">Fonte: CVM — Demonstrações Financeiras Padronizadas (DFP), versão mais recente de cada documento. EBITDA calculado não é o EBITDA ajustado da companhia.</p>
        </Card>
        <Card>
          <CardHeader title="Produtos e exposições" subtitle="Análise qualitativa Avermont — confira nos relatórios de RI" />
          <CardBody className="space-y-3 text-[12.5px]">
            {kb ? (
              <>
                <div><div className="text-[11px] uppercase tracking-wide text-muted">Principais produtos</div><ul className="list-disc pl-4 text-fg-2">{kb.products.map((p) => <li key={p}>{p}</li>)}</ul></div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">Exposição a commodities</div>
                  <ul className="space-y-1.5">
                    {kb.commodityExposure.map((e) => {
                      const it = getSummaryItem(e.commodity);
                      return (
                        <li key={e.commodity} className="rounded-md border border-line p-2">
                          <div className="flex items-center gap-2"><Link href={`/commodity/${e.commodity}`} className="font-medium hover:text-blue">{it?.name.pt ?? e.commodity}</Link><Badge tone={e.direction === "receita" ? "green" : e.direction === "custo" ? "red" : "gold"}>{e.direction}</Badge>{it && it.dataMode === "real" && <span className="ml-auto text-xs">12m <Change v={it.stats.changes.y1} /></span>}{it?.dataMode === "demo" && <Badge tone="purple">demo</Badge>}</div>
                          <div className="text-fg-2">{e.note}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div><div className="text-[11px] uppercase tracking-wide text-muted">Câmbio</div><p className="text-fg-2">{kb.currency}</p></div>
              </>
            ) : <p className="text-muted">Sem análise qualitativa cadastrada.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Análise de impacto de commodities" subtitle="Avermont Impact Engine" />
          <CardBody className="space-y-3 text-[12.5px]">
            {links.map(({ link, effect }) => (
              <div key={link.driver} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2"><span className="font-semibold">{link.scenario}</span><Badge tone={effect.direction === "positive" ? "green" : effect.direction === "negative" ? "red" : "gold"}>{effect.direction === "positive" ? "efeito positivo" : effect.direction === "negative" ? "efeito negativo" : "efeito misto"}</Badge></div>
                <p className="mt-1 text-fg-2"><b>Canal:</b> {effect.channel}.</p>
                <p className="text-fg-2">{link.explanation}</p>
                <p className="mt-1 text-muted"><b>O que pode compensar:</b> {link.counterfactors.join("; ")}.</p>
              </div>
            ))}
            {kb && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><b>Por que o preço da ação não acompanha automaticamente a commodity:</b> {kb.offsets.join("; ")}. Preços de ações também refletem expectativas já incorporadas, juros e risco.</div>}
            {kb && <div><div className="text-[11px] uppercase tracking-wide text-muted">Perguntas para investigar nos relatórios</div><ul className="list-disc pl-4 text-fg-2">{kb.keyQuestions.map((q) => <li key={q}>{q}</li>)}</ul></div>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cenário fundamental educacional" subtitle="Efeito de primeira ordem sobre receita e EBITDA" />
          <CardBody>{last?.revenue && last?.ebitdaCalculated ? <CompanyScenario revenue={last.revenue} ebitda={last.ebitdaCalculated} year={last.fiscalYear} commodities={commodityOptions} /> : <p className="text-sm text-muted">Dados insuficientes.</p>}</CardBody>
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
