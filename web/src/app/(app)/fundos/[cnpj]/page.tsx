import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader, Stat } from "@/components/ui";
import { Change } from "@/components/market/bits";
import { MiniLine } from "@/components/charts/MiniLine";
import { WatchButton } from "@/components/WatchButton";
import { EXPOSURE_LABEL, TAG_LABEL } from "@/lib/beneficiaries";
import { findFund, getCatalog, getFunds, type Fund } from "@/lib/market";
import { monthLabel } from "@/lib/fund-exposure";
import { getCurrentUser } from "@/lib/auth";
import { isWatched } from "@/lib/watchlist";
import { fmtCompact, fmtDate, fmtNumber, fmtPct } from "@/lib/format";

export default async function FundPage({ params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await params;
  const f = findFund(cnpj);
  if (!f) notFound();
  const user = await getCurrentUser();
  const watched = await isWatched(user?.id, "fund", cnpj);
  const p = f.performance;
  const d = f.documents;
  const fields: [string, string | null | undefined][] = [
    ["Nome oficial", f.name], ["CNPJ da classe", f.cnpj], ["Gestor", f.manager], ["Administrador", f.administrator], ["Tipo (CVM)", f.classType],
    ["Classificação CVM", f.classification], ["Classificação ANBIMA (cadastro CVM)", f.anbimaClassification], ["Indicador de desempenho", f.benchmark],
    ["Condomínio", f.condominium], ["Público-alvo", f.targetAudience], ["Início", fmtDate(f.startDate)], ["Pode investir 100% no exterior", f.foreign100pct ? "Sim" : "Não"],
  ];
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={<Link href="/beneficiarios">Ações e fundos beneficiados</Link>} accent="var(--gold)" title={f.name} subtitle={`CNPJ ${f.cnpj} · ${f.manager ?? "gestor não informado"}`} right={<WatchButton itemType="fund" itemRef={cnpj} initial={watched} loggedIn={!!user} />} />
      <div className="flex flex-wrap gap-2"><Badge tone={EXPOSURE_LABEL[f.exposureType]?.tone}>{EXPOSURE_LABEL[f.exposureType]?.label}</Badge>{f.tags.map((t) => <Badge key={t} tone="gold">{TAG_LABEL[t] ?? t}</Badge>)}</div>
      {f.holdings ? (
        <Notice tone="green">Carteira verificada: o fundo declarou à CVM o que tinha em {monthLabel(f.holdings.month)}.{f.holdings.confidentialShare > 0.01 && ` ${fmtPct(f.holdings.confidentialShare, 0, false)} do patrimônio estava em posições confidenciais (não divulgadas).`} A carteira muda todo mês.</Notice>
      ) : (
        <Notice tone="gold">Exposição {f.exposureBasis}. Sem carteira divulgada recente (CDA) para este fundo — hedge, derivativos e alavancagem não puderam ser verificados, por isso o simulador não gera números para ele.{f.vehicle === "fiagro" && " Fiagros costumam investir em crédito (CRAs) e imóveis rurais: não presumimos exposição direta a preços agrícolas."}</Notice>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card className="p-3"><Stat label="Patrimônio líquido" value={fmtCompact(p?.netAssetsDaily ?? f.netAssets)} sub={p ? fmtDate(p.quotaDate) : fmtDate(f.netAssetsDate)} /></Card>
        <Card className="p-3"><Stat label="12 meses" value={<Change v={p?.return12m} />} /></Card>
        <Card className="p-3"><Stat label="No ano" value={<Change v={p?.returnYtd} />} /></Card>
        <Card className="p-3"><Stat label="Volatilidade 12m" value={fmtPct(p?.volatility12m ?? null, 1, false)} /></Card>
        <Card className="p-3"><Stat label="Drawdown máx. 12m" value={<span className="text-down">{fmtPct(p?.maxDrawdown12m ?? null, 1, false)}</span>} /></Card>
        <Card className="p-3"><Stat label="Cotistas" value={p?.shareholders?.toLocaleString("pt-BR") ?? "—"} /></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cota (semanal)" subtitle={p ? `Informe diário CVM · ${p.observations} observações · última cota ${fmtNumber(p.quota, 6)} em ${fmtDate(p.quotaDate)}` : "Sem cotas no informe diário"} />
          <CardBody>{p ? <MiniLine points={p.weekly} color="#F59E0B" height={220} /> : <p className="text-sm text-muted">ETFs e Fiagros não publicam cota no informe diário de fundos da CVM.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Identificação e condições" subtitle={d ? `Lâmina de ${d.laminaMonth?.slice(4)}/${d.laminaMonth?.slice(0, 4)}` : "Lâmina não disponível para este fundo"} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
              {fields.map(([k, v]) => <div key={k}><dt className="text-[10.5px] uppercase tracking-wide text-muted">{k}</dt><dd className="text-fg-2">{v || "—"}</dd></div>)}
              <div><dt className="text-[10.5px] uppercase tracking-wide text-muted">Taxa de administração</dt><dd>{d?.managementFee ? `${d.managementFee}% a.a.${d.managementFeeMax ? ` (máx. ${d.managementFeeMax}%)` : ""}` : "consultar regulamento"}</dd></div>
              <div><dt className="text-[10.5px] uppercase tracking-wide text-muted">Taxa de performance</dt><dd>{d?.performanceFee ?? d?.performanceFeeDescription ?? "consultar regulamento"}</dd></div>
              <div><dt className="text-[10.5px] uppercase tracking-wide text-muted">Aplicação mínima</dt><dd>{d?.minimumInvestment ? `R$ ${d.minimumInvestment}` : "consultar lâmina"}</dd></div>
              <div><dt className="text-[10.5px] uppercase tracking-wide text-muted">Resgate (cotização / pagamento)</dt><dd>{d?.redemptionConversionDays || d?.redemptionPaymentDays ? `D+${d.redemptionConversionDays ?? "?"} / D+${d.redemptionPaymentDays ?? "?"}` : "consultar regulamento"}</dd></div>
              {d?.investmentPolicy && <div className="col-span-2"><dt className="text-[10.5px] uppercase tracking-wide text-muted">Política de investimento (lâmina)</dt><dd className="text-fg-2">{d.investmentPolicy}</dd></div>}
            </dl>
            <p className="mt-3 text-[11px] text-muted">Documentos oficiais (regulamento, lâmina, carteira): consulte o sistema de fundos da CVM pelo CNPJ {f.cnpj}. Data do cadastro de PL: {fmtDate(f.netAssetsDate)}.</p>
          </CardBody>
        </Card>
      </div>
      {f.holdings && <Portfolio f={f} />}
      <p className="text-xs text-muted">Fonte: CVM Dados Abertos ({getFunds().ingestedAt?.slice(0, 10)}).</p>
      <Disclaimer>Retornos passados não garantem resultados futuros. Material para estudo — não é oferta nem recomendação.</Disclaimer>
    </div>
  );
}

function Portfolio({ f }: { f: Fund }) {
  const h = f.holdings!;
  const cat = getCatalog();
  const name = (id: string) => cat.instruments.find((i) => i.id === id)?.name.pt ?? cat.currencies.find((c) => c.id === id)?.name.pt ?? id;
  const link = (id: string) => (cat.instruments.some((i) => i.id === id) ? `/commodity/${id}` : `/moedas/${id}`);
  const exposures = Object.entries(h.exposures).sort(([, a], [, b]) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Ligação com commodities e câmbio" subtitle={`Carteira de ${monthLabel(h.month)} · ${h.positions} posições · PL declarado ${fmtCompact(h.pl)}`} accent="var(--brand)" />
        <CardBody>
          {exposures.length === 0 ? <p className="text-sm text-muted">Nenhuma posição ligada a commodities ou ao dólar nesta carteira.</p> : (
            <ul className="space-y-3">
              {exposures.map(([id, e]) => (
                <li key={id} className="text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={link(id)} className="font-medium hover:text-blue">{name(id)}</Link>
                    <span className="num font-semibold">
                      {e.weight !== null ? <span className={e.weight < 0 ? "text-down" : ""}>{fmtPct(e.weight, 1, false)}</span> : <span className={e.side === "long" ? "text-up" : "text-down"}>futuros {e.side === "long" ? "comprados" : "vendidos"}</span>}
                    </span>
                  </div>
                  {e.weight !== null && <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className={e.weight < 0 ? "h-1.5 rounded-full bg-coral" : "h-1.5 rounded-full bg-emerald-500"} style={{ width: `${Math.min(100, Math.abs(e.weight) * 100)}%` }} /></div>}
                  <div className="mt-0.5 text-[11px] text-muted">
                    {e.weight !== null ? Object.entries(e.byVia).map(([v, w]) => `${v} ${fmtPct(w, 1, false)}`).join(" · ") : "o tamanho da posição em futuros não é divulgado"}
                    {e.weight !== null && e.via.some((v) => v.startsWith("futuros")) && " · também usa futuros"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted">&quot;Exterior&quot; inclui exposição ao dólar, salvo se o fundo fizer hedge cambial (o CDA não informa). Ações de produtoras não acompanham o preço da commodity 1 para 1.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Maiores posições" subtitle={`Percentual do patrimônio em ${monthLabel(h.month)}`} />
        <CardBody>
          <table className="fin-table w-full text-[12px]">
            <tbody>
              {h.top.map((p, i) => (
                <tr key={i}><td className="max-w-[260px] truncate" title={p.label}>{p.label}<div className="text-[10.5px] text-muted">{p.type}</div></td><td className="num text-right">{fmtPct(p.weight, 1, false)}</td></tr>
              ))}
            </tbody>
          </table>
          {h.futures.length > 0 && (
            <div className="mt-3 text-[12px]">
              <div className="mb-1 font-medium">Contratos futuros</div>
              <ul className="space-y-0.5 text-fg-2">{h.futures.map((x, i) => <li key={i}><span className={x.side === "long" ? "text-up" : "text-down"}>{x.side === "long" ? "comprado" : "vendido"}</span> · {x.label}</li>)}</ul>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
