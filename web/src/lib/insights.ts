import "server-only";
import { fmtDate, fmtNumber, fmtPct, fmtPrice } from "./format";
import { getCatalog, getForecasts, getMacro, getSummary, type SummaryItem } from "./market";
import { IMPACT_LINKS } from "./impact";

export interface MarketNote {
  id: string; date: string; title: string; summary: string; category: string;
  relatedCommodities: string[]; relatedCompanies: string[];
  whyItMatters: string; positives: string[]; negatives: string[];
  source: { label: string; url: string | null }; generated: true;
}

const real = (items: SummaryItem[]) => items.filter((i) => i.dataMode === "real" && i.stats?.last !== undefined);

export function latestMacro() {
  const m = getMacro();
  const last = (id: string) => {
    const s = m.indicators[id];
    if (!s?.points?.length) return null;
    const [date, value] = s.points[s.points.length - 1];
    return { date, value, name: s.name, unit: s.unit, source: s.source, points: s.points };
  };
  return { selic: last("selic-meta"), ipca12: last("ipca-12m"), ipcaM: last("ipca-mensal"), ibc: last("ibc-br"), focus: m.focus };
}

export function focusValue(indicator: string, year: string) {
  const f = getMacro().focus;
  return f?.items.find((i) => i.Indicador === indicator && i.DataReferencia === year) ?? null;
}

/** Resumo diário de mercado construído deterministicamente a partir dos dados (sem LLM). */
export function dailySummary() {
  const items = getSummary().items;
  const fx = items.filter((i) => i.type === "currency" && i.stats?.last !== undefined);
  const commodities = real(items).filter((i) => i.type === "instrument");
  const byY1 = [...commodities].filter((i) => i.stats.changes.y1 !== null).sort((a, b) => (b.stats.changes.y1 ?? 0) - (a.stats.changes.y1 ?? 0));
  const usd = fx.find((i) => i.id === "usdbrl");
  const macro = latestMacro();
  const year = new Date().getFullYear().toString();
  const focusFx = focusValue("Câmbio", year);
  const stale = commodities.filter((i) => i.stats.stale);
  const lastCommodityDate = commodities.map((i) => i.stats.lastDate).sort().pop();
  const bullets: string[] = [];
  if (usd) {
    bullets.push(
      `**Dólar (PTAX)** fechou em R$ ${fmtPrice(usd.stats.last)} em ${fmtDate(usd.stats.lastDate)} (${fmtPct(usd.stats.changes.d1, 2)} no dia, ${fmtPct(usd.stats.changes.m1)} em 30 dias, ${fmtPct(usd.stats.changes.ytd)} no ano).` +
        (focusFx ? ` A mediana do Focus para o fim de ${year} é R$ ${fmtPrice(focusFx.Mediana)}.` : ""),
    );
  }
  if (macro.selic) bullets.push(`**Selic** (meta Copom) em ${fmtNumber(macro.selic.value, 2)}% a.a.; **IPCA 12 meses** em ${macro.ipca12 ? fmtNumber(macro.ipca12.value, 2) + "%" : "—"} (${macro.ipca12 ? fmtDate(macro.ipca12.date, "pt", { month: "short", year: "numeric", timeZone: "UTC" }) : ""}).`);
  if (byY1.length >= 2) {
    const top = byY1.slice(0, 3).map((i) => `${i.name.pt} (${fmtPct(i.stats.changes.y1)})`).join(", ");
    const bottom = byY1.slice(-3).reverse().map((i) => `${i.name.pt} (${fmtPct(i.stats.changes.y1)})`).join(", ");
    bullets.push(`**Maiores altas em 12 meses** (preços internacionais mensais): ${top}. **Maiores quedas**: ${bottom}.`);
  }
  const fc = getForecasts().forecasts;
  const beats = Object.values(fc).flatMap((f) => Object.entries(f.horizons).filter(([, h]) => h.status === "ok" && h.beatsBaseline).map(([lb]) => `${f.id} ${lb}`));
  bullets.push(
    beats.length
      ? `**Forecast Engine**: modelos com ganho estatisticamente significativo sobre o passeio aleatório em ${beats.length} horizonte(s) publicados (${beats.slice(0, 4).join(", ")}). Nos demais, publicamos o passeio aleatório com intervalo empírico.`
      : "**Forecast Engine**: nenhum modelo superou o passeio aleatório com significância estatística nos horizontes vigentes; as previsões publicadas usam o último preço como estimativa central, com intervalo empírico.",
  );
  if (stale.length) {
    bullets.push(
      `⚠️ **Dados desatualizados**: ${stale.length} séries de commodities têm última observação em ${fmtDate(lastCommodityDate, "pt", { month: "long", year: "numeric", timeZone: "UTC" })}. A edição mais recente da fonte (Banco Mundial) ainda não foi integrada nesta implantação.`,
    );
  }
  return { generatedAt: getSummary().generatedAt, bullets };
}

/** Notas de mercado automáticas: eventos detectados nos dados + "Por que isso importa?". */
export function marketNotes(): MarketNote[] {
  const items = getSummary().items;
  const notes: MarketNote[] = [];
  const cat = getCatalog();
  const usd = items.find((i) => i.id === "usdbrl");
  if (usd?.stats?.last) {
    const m1 = usd.stats.changes.m1 ?? 0;
    const link = IMPACT_LINKS.find((l) => l.driver === "usdbrl");
    notes.push({
      id: "fx-usdbrl", date: usd.stats.lastDate, category: "moedas",
      title: `Dólar ${m1 >= 0 ? "sobe" : "cai"} ${fmtPct(Math.abs(m1)).replace("+", "")} em 30 dias e fecha a R$ ${fmtPrice(usd.stats.last)}`,
      summary: `A PTAX de venda variou ${fmtPct(usd.stats.changes.d1, 2)} no último pregão e ${fmtPct(usd.stats.changes.y1)} em 12 meses.`,
      relatedCommodities: ["soja", "minerio-ferro", "celulose-fibra-curta", "acucar"], relatedCompanies: ["SUZB3", "KLBN11", "VALE3", "PETR4"],
      whyItMatters: link?.explanation ?? "",
      positives: ["Exportadores com receita em dólar e custos em reais (celulose, minério, proteínas, grãos)."],
      negatives: ["Importadores de insumos (fertilizantes, químicos, resinas) e empresas com dívida em dólar sem hedge."],
      source: { label: "Banco Central do Brasil — PTAX", url: "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao" }, generated: true,
    });
  }
  for (const i of real(items).filter((x) => x.type === "instrument")) {
    const y1 = i.stats.changes.y1;
    const m1 = i.stats.changes.m1;
    if ((y1 !== null && Math.abs(y1) >= 0.25) || (m1 !== null && Math.abs(m1) >= 0.08)) {
      const inst = cat.instruments.find((c) => c.id === i.id);
      const links = IMPACT_LINKS.filter((l) => l.driver === i.id);
      const big = m1 !== null && Math.abs(m1) >= 0.08 ? { v: m1, lb: "no mês" } : { v: y1!, lb: "em 12 meses" };
      notes.push({
        id: `move-${i.id}`, date: i.stats.lastDate, category: i.category,
        title: `${i.name.pt}: ${big.v > 0 ? "alta" : "queda"} de ${fmtPct(Math.abs(big.v)).replace("+", "")} ${big.lb}`,
        summary: `Benchmark: ${inst?.benchmark ?? "—"}. Último preço publicado ${fmtPrice(i.stats.last)} ${i.unitLabel ?? ""} (${fmtDate(i.stats.lastDate, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}).`,
        relatedCommodities: [i.id], relatedCompanies: inst?.related.companies ?? [],
        whyItMatters: links[0]?.explanation ?? `Movimentos de ${i.name.pt} afetam o custo de quem compra e a receita de quem produz; o efeito líquido depende de contratos, câmbio e repasse.`,
        positives: links.flatMap((l) => l.effects.filter((e) => e.direction === (big.v > 0 ? "positive" : "negative")).map((e) => e.target)).slice(0, 4),
        negatives: links.flatMap((l) => l.effects.filter((e) => e.direction === (big.v > 0 ? "negative" : "positive")).map((e) => e.target)).slice(0, 4),
        source: { label: i.source?.label ?? "", url: i.source?.url ?? null }, generated: true,
      });
    }
  }
  const macro = latestMacro();
  if (macro.ipca12) {
    notes.push({
      id: "macro-ipca", date: macro.ipca12.date, category: "macro",
      title: `IPCA acumulado em 12 meses: ${fmtNumber(macro.ipca12.value, 2)}%`,
      summary: `Dado oficial do IBGE via SGS/BCB. Variação mensal mais recente: ${macro.ipcaM ? fmtNumber(macro.ipcaM.value, 2) + "%" : "—"}.`,
      relatedCommodities: ["milho", "soja", "acucar", "cafe-arabica"], relatedCompanies: [],
      whyItMatters: "Inflação persistente tende a manter juros altos por mais tempo, o que encarece capital de giro e estoques e pode fortalecer o real via diferencial de juros — afetando o preço em reais de commodities cotadas em dólar.",
      positives: ["Aplicações pós-fixadas (CDI)"], negatives: ["Empresas alavancadas", "Compras financiadas de insumos"],
      source: { label: "BCB SGS série 13522 (IBGE)", url: "https://www3.bcb.gov.br/sgspub/" }, generated: true,
    });
  }
  return notes.sort((a, b) => b.date.localeCompare(a.date));
}
