import { Disclaimer, Notice, PageHeader } from "@/components/ui";
import { PortfolioManager, type AssetOption } from "@/components/invest/PortfolioManager";
import { requireUser } from "@/lib/auth";
import { getCatalog, getCompanies, getFunds, getSummaryItem } from "@/lib/market";
import { BRL_CURRENCIES, loadPortfolios } from "@/lib/portfolio-data";

export const metadata = { title: "Minha Carteira" };

export default async function PortfolioPage() {
  const user = await requireUser("/invest/carteira");
  const portfolios = await loadPortfolios(user.id);
  const cat = getCatalog();
  const usd = getSummaryItem("usdbrl")?.stats?.last ?? null;
  const options: AssetOption[] = [
    ...BRL_CURRENCIES.map((id) => ({ type: "currency" as const, ref: id, label: cat.currencies.find((c) => c.id === id)?.pair ?? id, price: getSummaryItem(id)?.stats?.last ?? null, unitHint: "unidades da moeda" })),
    ...cat.instruments.filter((i) => i.dataMode === "real").map((i) => {
      const it = getSummaryItem(i.id);
      return { type: "commodity" as const, ref: i.id, label: `${i.name.pt} (${it?.unitLabel ?? i.unit})`, price: it?.stats?.last && usd ? it.stats.last * usd : null, unitHint: i.unit };
    }),
    ...getCompanies().companies.flatMap((c) => c.tickersGiven.map((t) => ({ type: "stock" as const, ref: t, label: `${t} — ${c.name}`, price: null, unitHint: "ações" }))),
    ...getFunds().funds.filter((f) => f.performance).map((f) => ({ type: "fund" as const, ref: f.cnpjDigits, label: f.name.slice(0, 90), price: f.performance!.quota, unitHint: "cotas" })),
    { type: "cash" as const, ref: "cdi", label: "Caixa rendendo ~CDI (Selic)", price: 1, unitHint: "R$" },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Invest"
        accent="var(--blue)"
        title="Minha carteira personalizada"
        subtitle="Monte uma carteira simulada com moedas, commodities, ações ligadas a commodities, fundos e caixa. O valor é registrado todos os dias e projetado para os próximos meses com os modelos da Avermont."
      />
      <Notice tone="blue">
        Ferramenta educacional: a Avermont não executa ordens, não custodia recursos e não recomenda ativos. Commodities representam exposição teórica ao benchmark internacional (não um produto investível específico).
      </Notice>
      <PortfolioManager portfolios={portfolios} options={options} />
      <Disclaimer />
    </div>
  );
}
