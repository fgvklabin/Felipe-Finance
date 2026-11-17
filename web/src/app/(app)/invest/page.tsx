import Link from "next/link";
import { Briefcase, Factory, FlaskRound, Landmark, Network } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { Change } from "@/components/market/bits";
import { TAG_LABEL } from "@/components/invest/FundsTable";
import { getCompanies, getFunds, getSummaryItem } from "@/lib/market";
import { latestMacro } from "@/lib/insights";
import { fmtCompact, fmtNumber, fmtPct } from "@/lib/format";

export const metadata = { title: "Avermont Invest" };

export default function InvestPage() {
  const companies = getCompanies().companies;
  const funds = getFunds().funds;
  const macro = latestMacro();
  const withPerf = funds.filter((f) => f.performance?.return12m !== null && f.performance?.return12m !== undefined);
  const tagCounts = Object.keys(TAG_LABEL).map((t) => ({ t, n: funds.filter((f) => f.tags.includes(t)).length })).filter((x) => x.n);
  const ret = withPerf.map((f) => f.performance!.return12m!).sort((a, b) => a - b);
  const q = (p: number) => ret[Math.floor(p * (ret.length - 1))];
  const sections = [
    { icon: Briefcase, href: "/invest/carteira", title: "Minha carteira", body: "Acompanhe diariamente uma carteira simulada e veja projeções com os modelos da Avermont.", color: "#10B981" },
    { icon: FlaskRound, href: "/invest/simulador", title: "Simulador de cenários", body: "Açúcar +10%, dólar +5%, juros −1 p.p.: efeitos diretos e qualitativos.", color: "#3B82F6" },
    { icon: Factory, href: "/invest/empresas", title: "Empresas e ações", body: `${companies.length} companhias ligadas a commodities, com DFP da CVM.`, color: "#8B5CF6" },
    { icon: Landmark, href: "/invest/fundos", title: "Fundos e ETFs", body: `${funds.length} fundos descobertos no cadastro oficial da CVM.`, color: "#F59E0B" },
    { icon: Network, href: "/impacto", title: "Impact Engine", body: "Como commodities e câmbio se transmitem para empresas e fundos.", color: "#06B6D4" },
  ];
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Avermont Invest" accent="var(--blue)" title="Inteligência para investidores" subtitle="Entenda como commodities, câmbio, juros e economia afetam empresas, fundos e ETFs ligados a recursos naturais. Plataforma educacional e analítica." />
      <Notice tone="blue">A Avermont não executa investimentos, não custodia recursos e não faz recomendação individualizada. Eventual distribuição futura de produtos ocorrerá apenas por instituições autorizadas, conforme a regulação brasileira.</Notice>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="panel group p-4 hover:border-line-strong">
            <s.icon size={20} style={{ color: s.color }} />
            <div className="mt-2 font-semibold group-hover:text-blue">{s.title}</div>
            <p className="mt-1 text-xs text-fg-2">{s.body}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Companhias — último exercício (DFP/CVM)" right={<Link href="/invest/empresas" className="text-xs text-blue hover:underline">Ver todas →</Link>} />
          <div className="overflow-x-auto">
            <table className="fin-table w-full min-w-[640px] text-[13px]">
              <thead><tr><th className="text-left">Ticker</th><th className="text-left">Setor</th><th className="text-right">Receita</th><th className="text-right">Var. anual</th><th className="text-right">Margem EBITDA calc.</th></tr></thead>
              <tbody>
                {companies.map((c) => {
                  const f = c.financials.at(-1), p = c.financials.at(-2);
                  return (
                    <tr key={c.cnpj}>
                      <td><Link href={`/invest/empresas/${c.tickersGiven[0]}`} className="font-semibold hover:text-blue">{c.tickersGiven.join("/")}</Link></td>
                      <td className="text-xs text-muted">{c.sector}</td>
                      <td className="num text-right">{fmtCompact(f?.revenue)}</td>
                      <td className="text-right"><Change v={f?.revenue && p?.revenue ? f.revenue / p.revenue - 1 : null} /></td>
                      <td className="num text-right">{fmtPct(f?.ebitdaCalculatedMargin ?? null, 1, false)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Fundos por tema" subtitle="Inferido do nome/classe CVM" />
            <CardBody className="flex flex-wrap gap-1.5">{tagCounts.map(({ t, n }) => <Badge key={t} tone="gold">{TAG_LABEL[t]} · {n}</Badge>)}</CardBody>
          </Card>
          <Card>
            <CardHeader title="Retorno em 12 meses — distribuição" subtitle={`${withPerf.length} fundos com cotas no informe diário`} />
            <CardBody className="grid grid-cols-3 text-center text-sm">
              <div><div className="text-[11px] text-muted">Percentil 25</div><Change v={q(0.25)} /></div>
              <div><div className="text-[11px] text-muted">Mediana</div><Change v={q(0.5)} /></div>
              <div><div className="text-[11px] text-muted">Percentil 75</div><Change v={q(0.75)} /></div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Contexto macro" />
            <CardBody className="space-y-1 text-[13px]">
              <div className="flex justify-between"><span className="text-fg-2">Selic (meta)</span><span className="num">{fmtNumber(macro.selic?.value, 2)}%</span></div>
              <div className="flex justify-between"><span className="text-fg-2">IPCA 12m</span><span className="num">{fmtNumber(macro.ipca12?.value, 2)}%</span></div>
              <div className="flex justify-between"><span className="text-fg-2">Dólar PTAX (12m)</span><Change v={getSummaryItem("usdbrl")?.stats.changes.y1} /></div>
              <div className="flex justify-between"><span className="text-fg-2">Índice do dólar réplica (12m)</span><Change v={getSummaryItem("dxy")?.stats.changes.y1} /></div>
            </CardBody>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
