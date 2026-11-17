import { Card, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { FundsTable } from "@/components/invest/FundsTable";
import { getFunds } from "@/lib/market";
import { toFundRows } from "@/lib/fund-rows";

export const metadata = { title: "ETFs" };

export default function EtfsPage() {
  const etfs = getFunds().funds.filter((f) => f.vehicle === "etf");
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Avermont Invest" accent="var(--gold)" title="ETFs ligados a commodities e moedas" subtitle="Fundos de índice registrados na CVM com tema de ouro, dólar ou commodities, identificados pelo cadastro oficial." />
      <Notice tone="gold">ETFs são negociados em bolsa: preço, volume e ticker de negociação vêm de dados licenciados da B3 (não integrados). O cadastro (CNPJ, gestor, patrimônio) é oficial da CVM; ETFs não publicam cota no informe diário de fundos.</Notice>
      <Card>
        <CardHeader title={`${etfs.length} ETFs`} />
        <FundsTable funds={toFundRows(etfs)} fixedVehicle="etf" />
      </Card>
      <Disclaimer />
    </div>
  );
}
