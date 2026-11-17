import Link from "next/link";
import { ArrowRight, Building2, Database, LineChart, Network, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Logo } from "@/components/shell/Sidebar";
import { TickerTape } from "@/components/market/TickerTape";
import { Sparkline, Change } from "@/components/market/bits";
import { getCatalog, getForecasts, getSummary } from "@/lib/market";
import { toRows } from "@/lib/rows";
import { fmtDate, fmtPrice } from "@/lib/format";
import { btnClass, cn } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const user = await getCurrentUser();
  const rows = toRows(getSummary().items, getCatalog()).filter((r) => r.dataMode === "real");
  const tape = rows.filter((r) => ["usdbrl", "eurbrl", "cnybrl", "dxy", "brent", "ouro", "soja", "milho", "cafe-arabica", "minerio-ferro", "cobre", "acucar"].includes(r.id));
  const usd = rows.find((r) => r.id === "usdbrl");
  const fc = getForecasts().forecasts["usdbrl"]?.horizons["30d"];
  const showcase = rows.filter((r) => ["soja", "cafe-arabica", "minerio-ferro", "ouro"].includes(r.id));
  const nReal = rows.length;
  const features = [
    { icon: Building2, color: "#10B981", title: "Avermont Business", body: "Compare fornecedores pelo custo total de aquisição, simule cenários de compra e veja o impacto de preços e câmbio no seu custo.", href: "/business" },
    { icon: LineChart, color: "#3B82F6", title: "Ações e fundos expostos", body: "Para cada commodity, as companhias e os fundos que tendem a se beneficiar da alta — com dados oficiais da CVM e os fatores que podem anular o efeito.", href: "/beneficiarios" },
    { icon: TrendingUp, color: "#8B5CF6", title: "Forecast Engine", body: "Previsões estatísticas validadas fora da amostra, com intervalos de incerteza e teste contra o passeio aleatório. Sem números inventados.", href: "/previsoes" },
    { icon: Network, color: "#F59E0B", title: "Impact Engine", body: "Mapa de relações entre commodities, moedas, empresas e setores — com canais de transmissão, contrapontos e limitações.", href: "/impacto" },
    { icon: Sparkles, color: "#06B6D4", title: "Avermont AI", body: "Assistente que explica os mercados com dados verificados da plataforma, cita fontes e datas e admite quando a informação não existe.", href: "/ai" },
    { icon: Database, color: "#F472B6", title: "Transparência de dados", body: "Cada número traz fonte, unidade, data, defasagem e licença. Dados de demonstração são sempre identificados.", href: "/fontes" },
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-fg-2 md:flex">
            <Link href="/visao-geral" className="hover:text-fg">Mercados</Link>
            <Link href="/previsoes" className="hover:text-fg">Previsões</Link>
            <Link href="/business" className="hover:text-fg">Business</Link>
            <Link href="/beneficiarios" className="hover:text-fg">Ações e fundos</Link>
            <Link href="/fontes" className="hover:text-fg">Fontes</Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? <Link href="/visao-geral" className={btnClass()}>Abrir plataforma</Link> : <><Link href="/login" className={btnClass("ghost")}>Entrar</Link><Link href="/cadastro" className={btnClass()}>Criar conta gratuita</Link></>}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-violet-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-16 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
          <div className="animate-fade-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-fg-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {nReal} séries reais de fontes oficiais · Brasil
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Understand markets.<br />
              <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">Anticipate opportunities.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-fg-2 md:text-lg">
              A Avermont conecta commodities físicas aos mercados financeiros com dados oficiais, análise quantitativa validada e inteligência artificial — para empresas que compram matérias-primas e investidores que querem entender os mercados.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/visao-geral" className={cn(btnClass(), "h-11 px-5 text-[15px]")}>Explorar mercados <ArrowRight size={16} /></Link>
              <Link href="/cadastro" className={cn(btnClass("outline"), "h-11 px-5 text-[15px]")}>Criar conta gratuita</Link>
            </div>
            <p className="mt-4 text-xs text-muted">Sem assinatura nesta fase. Conteúdo educacional — não é recomendação de investimento.</p>
          </div>
          <div className="panel animate-fade-up p-4 [animation-delay:120ms]">
            <div className="mb-3 flex items-center justify-between text-xs text-muted"><span>Painel ao vivo · dados reais</span><span>{fmtDate(usd?.lastDate)}</span></div>
            {usd && (
              <div className="mb-3 rounded-lg border border-line bg-bg-2 p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted">Dólar PTAX (BCB)</div>
                    <div className="num text-3xl font-semibold">R$ {fmtPrice(usd.last)}</div>
                    <div className="text-xs"><Change v={usd.d1} digits={2} /> no dia · <Change v={usd.ytd} /> no ano</div>
                  </div>
                  <Sparkline data={usd.spark} width={160} height={48} />
                </div>
                {fc?.status === "ok" && <div className="mt-2 text-[11px] text-muted">Forecast Engine 30d: faixa de 80% R$ {fmtPrice(fc.low)} – {fmtPrice(fc.high)} ({fc.beatsBaseline ? fc.modelLabel : "nenhum modelo superou o passeio aleatório"})</div>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {showcase.map((r) => (
                <Link key={r.id} href={r.href} className="rounded-lg border border-line p-3 hover:border-line-strong">
                  <div className="flex items-center gap-1.5 text-xs text-fg-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />{r.name}</div>
                  <div className="num mt-1 font-semibold">{fmtPrice(r.last)} <span className="text-[10px] font-normal text-muted">{r.unitLabel}</span></div>
                  <div className="flex items-center justify-between"><Change v={r.y1} /><Sparkline data={r.spark} width={64} height={20} /></div>
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-muted">Commodities: World Bank Pink Sheet (mensal, CC BY 4.0). Câmbio: BCB e BCE.</p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-10"><TickerTape rows={tape} /></div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Uma plataforma de inteligência de commodities</h2>
        <p className="mt-2 max-w-2xl text-fg-2">Para quem compra matéria-prima e para quem acompanha empresas e fundos ligados a recursos naturais.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link key={f.title} href={f.href} className="panel group p-5 transition-colors hover:border-line-strong">
              <div className="mb-3 inline-flex rounded-lg p-2" style={{ background: `${f.color}1f` }}><f.icon size={20} style={{ color: f.color }} /></div>
              <div className="font-semibold group-hover:text-blue">{f.title}</div>
              <p className="mt-1 text-sm text-fg-2">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-bg-2/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-3">
          {[
            { k: "Sem dados inventados", v: "Preços, cotações de fornecedores, fundos e demonstrações financeiras vêm de fontes identificadas. Demonstrações são rotuladas." },
            { k: "Previsões auditáveis", v: "Validação walk-forward, baseline obrigatória, teste de significância e histórico imutável de previsões." },
            { k: "Dados da sua empresa protegidos", v: "Workspaces isolados com papéis e permissões, auditoria e conformidade com a LGPD." },
          ].map((x) => (
            <div key={x.k}>
              <ShieldCheck className="mb-2 text-brand" size={20} />
              <div className="font-semibold">{x.k}</div>
              <p className="mt-1 text-sm text-fg-2">{x.v}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted">
        <span>© {new Date().getFullYear()} Avermont · Understand markets. Anticipate opportunities.</span>
        <span className="flex gap-4"><Link href="/privacidade">Privacidade (LGPD)</Link><Link href="/fontes">Fontes de dados</Link></span>
        <span className="w-full">A Avermont não é instituição financeira, não executa investimentos, não custodia recursos e não oferece recomendação individualizada. Qualquer distribuição futura de produtos de investimento ocorrerá por instituições autorizadas, conforme a regulação brasileira.</span>
      </footer>
    </div>
  );
}
