import { Card, CardHeader, Disclaimer, PageHeader } from "@/components/ui";
import { Simulator, type SimAsset } from "@/components/invest/Simulator";
import { getCatalog, getCompanies, getFunds, getSeries, getSummaryItem } from "@/lib/market";
import { simExposure } from "@/lib/fund-exposure";

export const metadata = { title: "Simulador de Cenários" };

function monthly(id: string): number[] {
  const s = getSeries(id);
  if (!s) return [];
  if (s.frequency === "monthly") return s.points.map((p) => p[1]);
  const m = new Map<string, number[]>();
  for (const [d, v] of s.points) m.set(d.slice(0, 7), [...(m.get(d.slice(0, 7)) ?? []), v]);
  return [...m.values()].map((a) => a.reduce((x, y) => x + y, 0) / a.length);
}

export default function SimulatorPage() {
  const cat = getCatalog();
  const assets: SimAsset[] = [
    ...cat.instruments.map((i) => ({ kind: "commodity" as const, ref: i.id, label: i.name.pt, demo: i.dataMode !== "real" })),
    { kind: "usd", ref: "usd", label: "Dólar (caixa em US$)" },
    { kind: "cdi", ref: "cdi", label: "CDI" },
    ...getCompanies().companies.flatMap((c) => c.tickersGiven.map((t) => ({ kind: "stock" as const, ref: t, label: `${t} — ${c.name}` }))),
  ];
  const history: Record<string, number[]> = { usdbrl: monthly("usdbrl") };
  const vol: Record<string, number> = { usd: getSummaryItem("usdbrl")?.stats?.volatility ?? 0, cdi: 0 };
  for (const i of cat.instruments.filter((x) => x.dataMode === "real")) {
    history[i.id] = monthly(i.id);
    vol[i.id] = getSummaryItem(i.id)?.stats?.volatility ?? 0;
  }
  const funds = getFunds().funds
    .map((f) => ({ ref: f.cnpjDigits, label: f.name.slice(0, 70), fund: simExposure(f.holdings) }))
    .sort((a, b) => Number(!!b.fund) - Number(!!a.fund) || a.label.localeCompare(b.label, "pt-BR"));
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ferramentas"
        accent="var(--blue)"
        title="Simulador de impacto em carteiras e fundos"
        subtitle="Simule choques em commodities, câmbio e juros sobre uma carteira educacional ou um fundo existente. Números só aparecem para exposições diretas e verificáveis (inclusive fundos com carteira divulgada à CVM); o restante recebe análise qualitativa."
      />
      <Card>
        <CardHeader title="Simulação" accent="var(--blue)" />
        <Simulator assets={assets} history={history} vol={vol} funds={funds} />
      </Card>
      <Disclaimer />
    </div>
  );
}
