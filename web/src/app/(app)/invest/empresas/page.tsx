import Link from "next/link";
import { Badge, Card, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { getCompanies, getSummaryItem } from "@/lib/market";
import { COMPANY_KB } from "@/lib/companies-kb";
import { fmtCompact, fmtPct } from "@/lib/format";

export const metadata = { title: "Empresas e Ações" };

export default function CompaniesPage() {
  const data = getCompanies();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Invest"
        accent="var(--blue)"
        title="Empresas ligadas a commodities"
        subtitle="Universo restrito a companhias com relação explicável com commodities, recursos naturais ou energia. Cadastro, tickers e demonstrações financeiras verificados nos dados abertos da CVM (FCA e DFP)."
      />
      <Notice tone="gold" title="Cotações em bolsa não integradas">
        Preço da ação, valor de mercado e múltiplos de valuation exigem licença de market data da B3 ou de provedor autorizado e não são exibidos. As empresas listadas são exemplos de estudo, não recomendações.
      </Notice>
      <Card>
        <CardHeader title="Companhias" subtitle={`FCA ${data.fcaYear ?? "—"} · DFP consolidada (exercícios ${data.companies[0]?.financials.map((f) => f.fiscalYear).join(", ")})`} />
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[1100px] text-[13px]">
            <thead><tr><th className="text-left">Ticker</th><th className="text-left">Companhia</th><th className="text-left">Setor (CVM)</th><th className="text-right">Receita</th><th className="text-right">EBITDA calc.</th><th className="text-right">Margem EBITDA</th><th className="text-right">Lucro líquido</th><th className="text-right">Dívida líquida</th><th className="text-left">Principais commodities</th><th>Ticker CVM</th></tr></thead>
            <tbody>
              {data.companies.map((c) => {
                const f = c.financials[c.financials.length - 1];
                const kb = COMPANY_KB.find((k) => k.tickers.some((t) => c.tickersGiven.includes(t)));
                return (
                  <tr key={c.cnpj}>
                    <td><Link href={`/invest/empresas/${c.tickersGiven[0]}`} className="font-semibold text-blue hover:underline">{c.tickersGiven.join(" / ")}</Link></td>
                    <td className="max-w-[220px] truncate">{c.name}</td>
                    <td className="text-xs text-muted">{c.sector}</td>
                    <td className="num text-right">{fmtCompact(f?.revenue)}</td>
                    <td className="num text-right">{fmtCompact(f?.ebitdaCalculated)}</td>
                    <td className="num text-right">{fmtPct(f?.ebitdaCalculatedMargin ?? null, 1, false)}</td>
                    <td className={`num text-right ${(f?.netIncome ?? 0) < 0 ? "text-down" : ""}`}>{fmtCompact(f?.netIncome)}</td>
                    <td className="num text-right">{fmtCompact(f?.netDebt)}</td>
                    <td className="text-xs">{kb?.commodityExposure.slice(0, 3).map((e) => getSummaryItem(e.commodity)?.name.pt ?? e.commodity).join(", ")}</td>
                    <td className="text-center">{c.tickersMismatch.length ? <Badge tone="gold" title="O código de negociação não foi encontrado no FCA da CVM">não confirmado</Badge> : <Badge tone="green">confirmado</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-muted">EBITDA calculado = EBIT (DRE) + depreciação, amortização e exaustão (DFC). Pode diferir do EBITDA ajustado divulgado pela companhia. Valores consolidados em R$ do último exercício disponível.</p>
      </Card>
      <Disclaimer />
    </div>
  );
}
