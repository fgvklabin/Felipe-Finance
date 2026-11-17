import { Card, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { RelationshipMap } from "@/components/impact/RelationshipMap";
import { IMPACT_LINKS } from "@/lib/impact";
import { correlationBetween, getCatalog } from "@/lib/market";

export const metadata = { title: "Impact Engine" };

export default function ImpactPage() {
  const cat = getCatalog();
  const names: Record<string, string> = Object.fromEntries([...cat.instruments.map((i) => [i.id, i.name.pt]), ...cat.currencies.map((c) => [c.id, c.pair])]);
  const correlations = Object.fromEntries(IMPACT_LINKS.map((l) => [l.driver, Object.fromEntries((l.correlationWith ?? []).map((id) => [id, correlationBetween(l.driver, id)]))]));
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Impact Engine"
        accent="var(--purple)"
        title="Mapa de relações econômicas"
        subtitle="Como mudanças em commodities e câmbio se transmitem para empresas, setores, moedas e fundos — com direção, canal, contrapontos, incerteza e limitações de cada relação."
      />
      <Notice tone="blue">
        As direções descrevem efeitos de <b>primeira ordem</b>. O impacto líquido depende de contratos, hedge, câmbio, repasse de preços e alavancagem. Correlação histórica não implica causalidade, e relações podem mudar de sinal ao longo do tempo.
      </Notice>
      <Card>
        <CardHeader title="Relações por vetor" subtitle="Selecione o vetor de preço; clique nos nós para detalhes" accent="var(--purple)" />
        <RelationshipMap links={IMPACT_LINKS} correlations={correlations} names={names} />
      </Card>
      <Disclaimer />
    </div>
  );
}
