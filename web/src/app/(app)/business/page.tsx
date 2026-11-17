import Link from "next/link";
import { Lightbulb, Users } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Disclaimer, PageHeader, Stat } from "@/components/ui";
import { MaterialsManager, type MaterialRow } from "@/components/business/MaterialsManager";
import { ScenarioPanel, type MaterialContext } from "@/components/business/ScenarioPanel";
import { PurchaseHistory } from "@/components/business/PurchaseHistory";
import { NoWorkspace } from "@/components/business/NoWorkspace";
import { PrintButton } from "@/components/PrintButton";
import { requireUser, roleAtLeast } from "@/lib/auth";
import { currentWorkspace, marketParams } from "@/lib/business";
import { query } from "@/lib/db";
import { getCatalog, getForecasts, getSeries, getSummaryItem } from "@/lib/market";
import { rankQuotes, type Quote } from "@/lib/procurement";
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format";

export const metadata = { title: "Avermont Business" };
const H: Record<"1" | "3" | "6", string> = { "1": "30d", "3": "90d", "6": "180d" };

export default async function BusinessPage() {
  const user = await requireUser("/business");
  const ws = await currentWorkspace(user);
  if (!ws) return <NoWorkspace />;
  const cat = getCatalog();
  const commodities = cat.instruments.map((i) => ({ id: i.id, label: i.name.pt }));
  const [materials, quotes, purchases] = await Promise.all([
    query<MaterialRow>("SELECT * FROM workspace_materials WHERE workspace_id = $1 ORDER BY created_at", [ws.workspace_id]),
    query<Quote & { commodity_id: string | null; supplier_verification: string | null }>("SELECT q.*, s.verification_status AS supplier_verification FROM supplier_quotations q LEFT JOIN suppliers s ON s.id = q.supplier_id WHERE q.workspace_id = $1", [ws.workspace_id]),
    query<{ id: string; material_id: string | null; purchased_at: string; quantity: number; unit_price: number; currency: string; supplier_name: string | null }>("SELECT * FROM procurement_history WHERE workspace_id = $1 ORDER BY purchased_at DESC", [ws.workspace_id]),
  ]);
  const mp = marketParams();
  const fcAll = getForecasts().forecasts;
  const usd = getSummaryItem("usdbrl")?.stats;

  const rows: MaterialRow[] = materials.map((m) => {
    const it = m.commodity_id ? getSummaryItem(m.commodity_id) : null;
    return { ...m, market: it ? { name: it.name.pt, m1: it.stats?.changes?.m1 ?? null, y1: it.stats?.changes?.y1 ?? null, stale: !!it.stats?.stale, demo: it.dataMode === "demo" } : null };
  });
  const contexts: MaterialContext[] = materials.map((m) => {
    const f = m.commodity_id ? fcAll[m.commodity_id] : undefined;
    const forecasts = { "1": null, "3": null, "6": null } as MaterialContext["forecasts"];
    let note: string | null = m.commodity_id ? null : "Material sem mercado de referência vinculado: use o cenário manual.";
    if (f) {
      (Object.keys(H) as ("1" | "3" | "6")[]).forEach((k) => {
        const h = f.horizons[H[k]];
        if (h?.status === "ok" && h.central && f.origin.value) forecasts[k] = { central: h.central / f.origin.value - 1, low: h.low! / f.origin.value - 1, high: h.high! / f.origin.value - 1, model: h.modelLabel ?? "", beats: !!h.beatsBaseline };
      });
      if (!forecasts["1"] && !forecasts["3"] && !forecasts["6"]) note = "Previsões do mercado vinculado estão expiradas (fonte desatualizada) ou não publicadas: use o cenário manual.";
    } else if (m.commodity_id) note = "Mercado vinculado sem previsão (série demonstrativa ou sem dados suficientes): use o cenário manual.";
    const sameQuotes = quotes.filter((q) => q.commodity_id === m.commodity_id && m.commodity_id && q.unit === m.unit);
    const best = rankQuotes(sameQuotes, mp.fx, mp.rateMonthly, "total", m.monthly_consumption).find((x) => x.cost.eligible);
    return { ...m, marketName: m.commodity_id ? getSummaryItem(m.commodity_id)?.name.pt ?? null : null, forecasts, forecastNote: note, altSupplierPrice: best?.cost.perUnit ?? null, altSupplierName: best?.quote.supplier_name ?? null };
  });

  const spend = materials.reduce((a, m) => a + m.monthly_consumption * m.current_price, 0);
  const usdExposure = materials.reduce((a, m) => a + m.monthly_consumption * m.current_price * (m.usd_share / 100), 0);
  const savings = contexts.reduce((a, c) => a + (c.altSupplierPrice !== null && c.altSupplierPrice < c.current_price ? (c.current_price - c.altSupplierPrice) * c.monthly_consumption : 0), 0);
  const eligibleQuotes = rankQuotes(quotes, mp.fx, mp.rateMonthly).filter((x) => x.cost.eligible).length;
  const inventoryValue = materials.reduce((a, m) => a + m.inventory_qty * m.current_price, 0);

  // Oportunidades de negociação (regras transparentes sobre dados reais)
  const opps: { text: string; tone: "green" | "gold" | "blue" }[] = [];
  for (const c of contexts) {
    const it = c.commodity_id ? getSummaryItem(c.commodity_id) : null;
    if (it && it.dataMode === "real" && (it.stats?.changes?.m3 ?? 0) <= -0.05) opps.push({ tone: "green", text: `${c.name}: o benchmark ${it.name.pt} caiu ${fmtPct(it.stats.changes.m3)} em 3 meses (até ${fmtDate(it.stats.lastDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}). Argumento objetivo para renegociar.` });
    if (it && it.dataMode === "real" && (it.stats?.changes?.m3 ?? 0) >= 0.08) opps.push({ tone: "gold", text: `${c.name}: o benchmark ${it.name.pt} subiu ${fmtPct(it.stats.changes.m3)} em 3 meses. Avalie travar preço ou ampliar prazo de contratos vigentes.` });
    if (c.altSupplierPrice !== null && c.altSupplierPrice < c.current_price) opps.push({ tone: "green", text: `${c.name}: a melhor cotação verificada (${c.altSupplierName}) custa ${fmtMoney(c.altSupplierPrice)}/${c.unit} entregue, ${fmtPct(c.altSupplierPrice / c.current_price - 1)} vs. seu preço atual.` });
    if (c.usd_share > 0 && (usd?.changes?.m1 ?? 0) <= -0.03) opps.push({ tone: "blue", text: `${c.name}: o dólar caiu ${fmtPct(usd?.changes.m1)} em 30 dias; renegocie a parcela dolarizada (${fmtNumber(c.usd_share, 0)}%).` });
  }
  const expiring = quotes.filter((q) => q.valid_until && new Date(q.valid_until).getTime() - Date.now() < 7 * 86400000 && new Date(q.valid_until).getTime() > Date.now());
  if (expiring.length) opps.push({ tone: "gold", text: `${expiring.length} cotação(ões) vencem nos próximos 7 dias.` });

  const benchmarks: Record<string, { label: string; points: [string, number][] }> = {};
  for (const m of materials) {
    if (!m.commodity_id) continue;
    const s = getSeries(m.commodity_id);
    if (s?.brlPoints) benchmarks[m.id] = { label: getSummaryItem(m.commodity_id)?.name.pt ?? m.commodity_id, points: s.brlPoints };
  }
  const canEdit = roleAtLeast(ws.role, "buyer");
  const selicLabel = mp.selicAnnual ? `Selic ${fmtNumber(mp.selicAnnual, 2)}% a.a.` : "taxa indisponível";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Business"
        accent="var(--brand)"
        title={ws.workspace_name}
        subtitle="Custos de compra, exposição a preços e câmbio, cenários e fornecedores — dados confidenciais do seu workspace."
        right={<><Badge tone="blue">papel: {ws.role}</Badge><Link href="/business/equipe" className="inline-flex items-center gap-1 text-xs text-blue hover:underline"><Users size={13} /> Equipe</Link><Link href="/business/fornecedores" className="text-xs text-blue hover:underline">Comparador de fornecedores →</Link><PrintButton /></>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className="p-3"><Stat label="Gasto mensal estimado" value={fmtMoney(spend, "BRL", "pt", 0)} sub={`${materials.length} matérias-primas`} /></Card>
        <Card className="p-3"><Stat label="Gasto anualizado" value={fmtMoney(spend * 12, "BRL", "pt", 0)} sub="consumo constante" /></Card>
        <Card className="p-3"><Stat label="Exposição ao dólar" value={fmtMoney(usdExposure, "BRL", "pt", 0)} sub={`${spend ? fmtPct(usdExposure / spend, 0, false) : "—"} do gasto · PTAX R$ ${fmtNumber(mp.fx.USD, 4)}`} /></Card>
        <Card className="p-3"><Stat label="Estoque (valor)" value={fmtMoney(inventoryValue, "BRL", "pt", 0)} /></Card>
        <Card className="p-3"><Stat label="Economia potencial/mês" value={fmtMoney(savings, "BRL", "pt", 0)} tone={savings > 0 ? "text-up" : undefined} sub="melhor cotação verificada vs. preço atual" /></Card>
        <Card className="p-3"><Stat label="Cotações elegíveis" value={eligibleQuotes} sub={`de ${quotes.length} registradas`} /></Card>
      </div>
      <Card>
        <CardHeader title="Matérias-primas" subtitle="Vincule cada item a um mercado de referência para calcular impacto de preço automaticamente" accent="var(--brand)" />
        <MaterialsManager materials={rows} commodities={commodities} canEdit={canEdit} />
      </Card>
      <Card>
        <CardHeader title="Impacto e cenários de compra" subtitle="Comprar agora, gradualmente, adiar, contrato a preço fixo ou fornecedor alternativo — com vantagens, riscos e faixas de custo" accent="var(--blue)" />
        <ScenarioPanel materials={contexts} rateMonthly={mp.rateMonthly} selicLabel={selicLabel} />
      </Card>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Histórico de compras" subtitle="Seu preço pago vs. benchmark internacional convertido em reais" />
          <PurchaseHistory purchases={purchases} materials={materials.map((m) => ({ id: m.id, name: m.name, unit: m.unit }))} benchmarks={benchmarks} canEdit={canEdit} />
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Lightbulb size={15} className="text-gold" /> Oportunidades e alertas de compra</span>} subtitle="Regras objetivas sobre seus dados e dados de mercado" right={<Link href="/alertas" className="text-xs text-blue hover:underline">Configurar alertas</Link>} />
          <CardBody className="space-y-2">
            {opps.length === 0 && <p className="text-sm text-muted">Nenhuma oportunidade identificada com os dados atuais. Cadastre materiais, cotações e compras para análises mais ricas.</p>}
            {opps.map((o, i) => <div key={i} className={`rounded-lg border p-2.5 text-[12.5px] ${o.tone === "green" ? "border-emerald-500/30 bg-emerald-500/5" : o.tone === "gold" ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>{o.text}</div>)}
          </CardBody>
        </Card>
      </div>
      <Disclaimer>Estimativas sob premissas explícitas (consumo constante, condições comerciais equivalentes, câmbio PTAX e Selic do BCB). Não constituem garantia de preços ou economias. Não adie compras essenciais com base apenas em previsões de mercado.</Disclaimer>
    </div>
  );
}
