import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader, Stat } from "@/components/ui";
import { Change } from "@/components/market/bits";
import { MiniLine } from "@/components/charts/MiniLine";
import { WatchButton } from "@/components/WatchButton";
import { EXPOSURE_LABEL, TAG_LABEL } from "@/components/invest/FundsTable";
import { findFund, getFunds } from "@/lib/market";
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
      <PageHeader eyebrow={<Link href="/invest/fundos">Fundos</Link>} accent="var(--gold)" title={f.name} subtitle={`CNPJ ${f.cnpj} · ${f.manager ?? "gestor não informado"}`} right={<WatchButton itemType="fund" itemRef={cnpj} initial={watched} loggedIn={!!user} />} />
      <div className="flex flex-wrap gap-2"><Badge tone={EXPOSURE_LABEL[f.exposureType]?.tone}>{EXPOSURE_LABEL[f.exposureType]?.label}</Badge>{f.tags.map((t) => <Badge key={t} tone="gold">{TAG_LABEL[t] ?? t}</Badge>)}</div>
      <Notice tone="gold">Exposição {f.exposureBasis}. Hedge, derivativos e alavancagem só podem ser avaliados com a carteira divulgada (CDA), ainda não integrada — por isso o simulador não gera números para este fundo.{f.vehicle === "fiagro" && " Fiagros costumam investir em crédito (CRAs) e imóveis rurais: não presumimos exposição direta a preços agrícolas."}</Notice>
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
      <p className="text-xs text-muted">Fonte: CVM Dados Abertos ({getFunds().ingestedAt?.slice(0, 10)}).</p>
      <Disclaimer>Retornos passados não garantem resultados futuros. Material para estudo — não é oferta nem recomendação.</Disclaimer>
    </div>
  );
}
