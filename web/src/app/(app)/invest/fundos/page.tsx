import { Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { FundsTable, EXPOSURE_LABEL } from "@/components/invest/FundsTable";
import { getFunds } from "@/lib/market";
import { toFundRows } from "@/lib/fund-rows";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Fundos de Investimento" };

export default function FundsPage() {
  const { funds, ingestedAt } = getFunds();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Invest"
        accent="var(--gold)"
        title="Fundos com exposição a commodities e moedas"
        subtitle={`${funds.length} fundos, ETFs e Fiagros descobertos no cadastro oficial da CVM (Resolução 175) — nenhum nome inventado. Cotas do informe diário da CVM; taxas da lâmina quando disponível. Atualizado em ${fmtDateTime(ingestedAt)}.`}
      />
      <Notice tone="gold" title="Como interpretar a exposição">
        A exposição foi <b>inferida do nome e da classe CVM</b>; a carteira (CDA) ainda não é analisada. Fundos de índice de ouro têm exposição direta ao índice; fundos cambiais, ao dólar;
        fundos de ações têm exposição <b>indireta</b> (via empresas produtoras); multimercados podem ou não manter posições, com hedge, derivativos e alavancagem que mudam ao longo do tempo;
        <b> Fiagros investem majoritariamente em crédito e imóveis do agronegócio — não pressupomos exposição direta a preços agrícolas.</b> Divulgações de carteira têm defasagem.
      </Notice>
      <Card>
        <CardBody className="grid gap-3 text-[12px] sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(EXPOSURE_LABEL).map(([k, v]) => <div key={k}><div className="font-semibold">{v.label}</div><div className="text-muted">{funds.filter((f) => f.exposureType === k).length} fundos</div></div>)}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Diretório de fundos" subtitle="Filtre por tema (ouro, petróleo, agro, açúcar, café, metais, dólar, moedas emergentes, macro), veículo, tipo de exposição e risco" />
        <FundsTable funds={toFundRows(funds)} />
      </Card>
      <Disclaimer>Retornos passados não garantem resultados futuros. Informações para estudo; antes de investir, leia regulamento, lâmina e material da instituição distribuidora autorizada.</Disclaimer>
    </div>
  );
}
