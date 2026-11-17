import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { Heatmap } from "@/components/market/Heatmap";
import { MarketTable } from "@/components/market/MarketTable";
import { CompareChart } from "@/components/charts/CompareChart";
import { getCatalog, visibleItems } from "@/lib/market";
import { toRows } from "@/lib/rows";
import { getPrefs } from "@/lib/prefs";
import { CATEGORY_ROUTES } from "@/lib/nav";

const INTRO: Record<string, string> = {
  agricolas: "Grãos, oleaginosas, fibras e softs. Benchmarks internacionais mensais do Banco Mundial; indicadores físicos brasileiros (CEPEA) exigem licença.",
  metais: "Metais básicos (LME) e preciosos. Benchmarks mensais do Banco Mundial; aço laminado exige provedor licenciado.",
  polimeros: "Resinas termoplásticas (PET, PVC, ABS, PP, PEAD, PEBD). Não há fonte aberta licenciada para preços de resinas: todas as séries desta categoria são DEMONSTRATIVAS.",
  quimicos: "Químicos industriais e fertilizantes. Fertilizantes (ureia, DAP, KCl) têm benchmark real do Banco Mundial; glicerina, ácido cítrico, soda cáustica e amido são DEMONSTRATIVOS.",
  "papel-celulose": "Celulose, papéis e madeira. Preços de celulose e papel exigem licença (FOEX, Fastmarkets RISI); a madeira usa benchmark tropical do Banco Mundial.",
  energia: "Petróleo, gás natural e combustíveis. Petróleo e gás com benchmarks mensais do Banco Mundial; etanol e diesel brasileiros aguardam integração (CEPEA/ANP).",
};

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = getCatalog().categories.find((x) => x.id === category);
  return { title: c?.name.pt ?? "Mercados" };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const ids = CATEGORY_ROUTES[category];
  if (!ids) notFound();
  const prefs = await getPrefs();
  const cat = getCatalog();
  const c = cat.categories.find((x) => x.id === ids[0])!;
  const rows = toRows(visibleItems(prefs.dataMode), cat, prefs.locale).filter((r) => ids.includes(r.category));
  const options = cat.instruments.filter((i) => ids.includes(i.category)).map((i) => ({ id: i.id, label: i.name.pt, demo: i.dataMode === "demo" }));
  const base = options.find((o) => !o.demo)?.id ?? options[0]?.id;
  const allDemo = rows.length > 0 && rows.every((r) => r.dataMode === "demo");
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mercados" accent={c.color} title={category === "metais" ? "Metais e metais preciosos" : c.name.pt} subtitle={INTRO[category]} />
      {allDemo && <Notice tone="red" title="Categoria sem dados reais licenciados">Todas as séries abaixo são índices sintéticos para demonstração. Para dados reais, é necessário contratar um provedor (ver Fontes de Dados).</Notice>}
      {rows.length === 0 && <Notice tone="gold">Nenhuma série visível no modo “somente dados reais”. Alterne para “Real + Demonstração” no topo para ver as séries demonstrativas.</Notice>}
      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader title="Mapa de calor" accent={c.color} />
            <CardBody><Heatmap rows={rows} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Cotações" subtitle="Ordene por qualquer coluna" />
            <MarketTable rows={rows} showCategoryFilter={ids.length > 1} />
          </Card>
          {base && (
            <Card>
              <CardHeader title="Comparação" subtitle="Séries normalizadas (base 100)" />
              <CompareChart base={base} options={options} years={10} />
            </Card>
          )}
        </>
      )}
      <Disclaimer />
    </div>
  );
}
