import "server-only";
import { getCatalog, getCompanies, getForecasts, getFunds, getMacro, getSummary, getSummaryItem, correlationBetween } from "../market";
import { IMPACT_LINKS } from "../impact";
import { COMPANY_KB } from "../companies-kb";
import { SOURCES } from "../sources-registry";
import { stocksFor, fundsFor } from "../beneficiaries";
import { BASIS_LABEL, exposureText, monthLabel } from "../fund-exposure";
import { quarterLabel } from "../quarters";
import { fmtCompact, fmtDate, fmtNumber, fmtPct, fmtPrice } from "../format";
import { query } from "../db";
import { rankQuotes } from "../procurement";
import { marketParams } from "../business";

// Recuperação para a Avermont AI: documentos construídos a partir de dados VERIFICADOS da plataforma.
// Dados de workspace entram somente para membros autenticados daquele workspace (isolamento).

export interface Doc { id: string; title: string; body: string; url: string | null; asOf: string | null; source: string; scope: "public" | "workspace"; keys: string[] }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2);

// Sinônimos para perguntas em linguagem natural
const SYN: Record<string, string[]> = {
  cafe: ["cafe-arabica", "cafe-robusta"], dolar: ["usdbrl", "dxy"], cambio: ["usdbrl", "eurbrl"], celulose: ["celulose-fibra-curta", "celulose-fibra-longa", "suzb3", "klbn11"],
  petroleo: ["brent", "wti", "petr4"], acucar: ["acucar", "smto3", "jall3"], cobre: ["cobre"], ouro: ["ouro"], minerio: ["minerio-ferro", "vale3"], china: ["cnybrl", "minerio-ferro", "soja", "cobre"],
  juros: ["selic", "focus"], inflacao: ["ipca", "focus"], fornecedor: ["workspace", "cotacoes"], fornecedores: ["workspace", "cotacoes"], compras: ["workspace", "materiais"],
  curva: ["futuros", "focus"], futura: ["futuros"], previsao: ["forecast"], fundos: ["fundos"], fundo: ["fundos"], algodao: ["algodao"], soja: ["soja"], milho: ["milho"],
  klabin: ["klbn11"], suzano: ["suzb3"], vale: ["vale3"], petrobras: ["petr4"], gerdau: ["ggbr4"],
};

let cache: { key: string; docs: Doc[] } | null = null;

export function publicDocs(): Doc[] {
  const key = String(getSummary().generatedAt) + String(getForecasts().generatedAt);
  if (cache?.key === key) return cache.docs;
  const docs: Doc[] = [];
  const cat = getCatalog();
  const fcs = getForecasts().forecasts;
  for (const inst of cat.instruments) {
    const it = getSummaryItem(inst.id);
    const s = it?.stats;
    const fc = fcs[inst.id];
    const horizons = fc ? Object.entries(fc.horizons).map(([h, x]) => x.status === "ok" ? `${h}: central ${fmtPrice(x.central)} (faixa ${fmtPrice(x.low)}–${fmtPrice(x.high)}), ${x.beatsBaseline ? `modelo ${x.modelLabel} superou o passeio aleatório` : "nenhum modelo superou o passeio aleatório (central = último preço)"}` : `${h}: ${x.message}`).join("; ") : "sem previsão (série não modelada)";
    const corr = correlationBetween(inst.id, "usdbrl");
    docs.push({
      id: `commodity:${inst.id}`, title: `${inst.name.pt} — preço, previsão e fundamentos`, scope: "public", keys: [inst.id, ...tokens(inst.name.pt)],
      url: `/commodity/${inst.id}`, asOf: s?.lastDate ?? null, source: it?.source?.label ?? "—",
      body: inst.dataMode === "demo"
        ? `${inst.name.pt}: SÉRIE DEMONSTRATIVA (sem preço real licenciado). Referência real: ${inst.brazilRef}. Fundamentos: produtores ${inst.fundamentals.producers.join(", ")}; vetores ${inst.fundamentals.drivers.join("; ")}.`
        : `${inst.name.pt} (${inst.benchmark}). Último preço ${fmtPrice(s?.last)} ${it?.unitLabel} em ${fmtDate(s?.lastDate)}${s?.stale ? " (DADO DESATUALIZADO: fonte não publicou edição mais recente)" : ""}. Variações: mês ${fmtPct(s?.changes.m1)}, 3 meses ${fmtPct(s?.changes.m3)}, 12 meses ${fmtPct(s?.changes.y1)}, no ano ${fmtPct(s?.changes.ytd)}. Volatilidade anualizada ${fmtPct(s?.volatility ?? null, 1, false)}. Previsões Avermont: ${horizons}. Vetores de preço (qualitativos): ${inst.fundamentals.drivers.join("; ")}. Sazonalidade: ${inst.fundamentals.seasonality} Clima: ${inst.fundamentals.weather} Geopolítica: ${inst.fundamentals.geopolitics}${corr ? ` Correlação mensal com USD/BRL (10 anos): ${fmtNumber(corr.r, 2)} (faixa em janelas de 36m: ${fmtNumber(corr.rollingMin, 2)} a ${fmtNumber(corr.rollingMax, 2)}).` : ""}`,
    });
    const st = stocksFor(inst.id), fu = fundsFor(inst.id).filter((f) => f.exposure.basis !== "nao_verificada");
    if (st.length || fu.length) {
      docs.push({
        id: `benef:${inst.id}`, title: `Quem pode se beneficiar da alta de ${inst.name.pt}`, scope: "public", keys: [inst.id, "beneficiar", "acoes", "fundos", ...tokens(inst.name.pt)],
        url: `/beneficiarios?c=${inst.id}`, asOf: null, source: "CVM (cadastro e DFP) + análise qualitativa Avermont",
        body: `Ações com receita ligada a ${inst.name.pt}: ${st.map((x) => `${x.tickers.join("/")} (${x.name}; ${x.strength === "direta" ? "efeito positivo" : "efeito misto"}: ${x.channels[0]})`).join("; ") || "nenhuma"}. Fundos com o tema: ${fu.slice(0, 8).map((x) => `${x.fund.name} (CNPJ ${x.fund.cnpj}, ${BASIS_LABEL[x.exposure.basis].label}: ${exposureText(x.exposure)})`).join("; ") || "nenhum"}. A alta da commodity não garante alta das ações/fundos.`,
      });
    }
  }
  for (const c of cat.currencies) {
    const it = getSummaryItem(c.id);
    const fc = fcs[c.id];
    const h = fc ? Object.entries(fc.horizons).filter(([, x]) => x.status === "ok").map(([k, x]) => `${k}: ${fmtNumber(x.central, 4)} (faixa ${fmtNumber(x.low, 4)}–${fmtNumber(x.high, 4)}; ${x.beatsBaseline ? "modelo com ganho significativo" : "passeio aleatório"})`).join("; ") : "—";
    docs.push({
      id: `fx:${c.id}`, title: `${c.pair} — câmbio`, scope: "public", keys: [c.id, ...tokens(c.name.pt), ...tokens(c.pair)],
      url: `/moedas/${c.id}`, asOf: it?.stats?.lastDate ?? null, source: it?.source?.label ?? c.provider,
      body: c.dataMode === "unavailable" ? `${c.pair}: indisponível. ${c.description} ${c.commodityLink}` : `${c.pair} (${c.description}) em ${fmtNumber(it?.stats?.last, 4)} ${c.unitLabel} em ${fmtDate(it?.stats?.lastDate)}; dia ${fmtPct(it?.stats?.changes.d1, 2)}, 30 dias ${fmtPct(it?.stats?.changes.m1)}, 12 meses ${fmtPct(it?.stats?.changes.y1)}. Previsões Avermont: ${h}. Relação com commodities: ${c.commodityLink}`,
    });
  }
  const macro = getMacro();
  for (const ind of Object.values(macro.indicators)) {
    const last = ind.points[ind.points.length - 1];
    docs.push({ id: `macro:${ind.id}`, title: ind.name, scope: "public", keys: [ind.id, ...tokens(ind.name), ind.id.includes("selic") ? "selic" : "", ind.id.includes("ipca") ? "ipca" : ""], url: "/moedas#indicadores", asOf: last?.[0] ?? null, source: ind.source, body: `${ind.name}: ${fmtNumber(last?.[1], 2)} ${ind.unit} em ${fmtDate(last?.[0])}.` });
  }
  if (macro.focus) {
    docs.push({
      id: "focus", title: "Expectativas de mercado — Boletim Focus", scope: "public", keys: ["focus", "expectativa", "selic", "ipca", "pib", "cambio", "dolar"], url: "/moedas", asOf: macro.focus.date, source: macro.focus.source,
      body: `Medianas do Focus (${fmtDate(macro.focus.date)}): ` + macro.focus.items.map((i) => `${i.Indicador} ${i.DataReferencia}: ${fmtNumber(i.Mediana, 2)}`).join("; ") + ". São expectativas de economistas, não previsões da Avermont nem preços de contratos futuros.",
    });
  }
  for (const co of getCompanies().companies) {
    const kb = COMPANY_KB.find((k) => k.tickers.some((t) => co.tickersGiven.includes(t)));
    const fin = co.financials.map((f) => `${f.fiscalYear}: receita ${fmtCompact(f.revenue)}, EBITDA calc. ${fmtCompact(f.ebitdaCalculated)} (margem ${fmtPct(f.ebitdaCalculatedMargin ?? null, 1, false)}), lucro ${fmtCompact(f.netIncome)}, dívida líquida ${fmtCompact(f.netDebt)}`).join("; ");
    const qs = (co.quarters ?? []).map((q) => `${quarterLabel(q.period)}: receita ${fmtCompact(q.revenue)}${q.revenueYoY !== undefined ? ` (${fmtPct(q.revenueYoY)} vs. 1 ano antes)` : ""}, EBITDA calc. ${fmtCompact(q.ebitdaCalculated ?? null)}, lucro ${fmtCompact(q.netIncome ?? null)}, dívida líquida ${fmtCompact(q.netDebt ?? null)}${q.source !== "ITR" ? " (anual menos 9 meses)" : ""}`).join("; ");
    docs.push({
      id: `company:${co.tickersGiven[0]}`, title: `${co.tickersGiven.join("/")} — ${co.name}`, scope: "public", keys: [...co.tickersGiven.map(norm), ...tokens(co.name ?? ""), ...(kb ? tokens(kb.shortName) : [])],
      url: `/empresas/${co.tickersGiven[0]}`, asOf: co.quarters?.at(-1)?.end ?? co.financials.at(-1)?.fiscalYearEnd ?? null, source: "CVM — FCA, DFP e ITR (consolidado)",
      body: `${co.name} (${co.sector}). Atividade (FCA): ${co.activityDescription}. Demonstrações anuais (DFP/CVM): ${fin}.${qs ? ` Resultados trimestrais (ITR/CVM): ${qs}.` : ""} ${kb ? `Produtos: ${kb.products.join(", ")}. Exposição a commodities: ${kb.commodityExposure.map((e) => `${e.commodity} (${e.direction}: ${e.note})`).join("; ")}. Câmbio: ${kb.currency} Fatores que podem compensar: ${kb.offsets.join("; ")}.` : ""} Cotação da ação não disponível (exige licença B3).`,
    });
  }
  for (const l of IMPACT_LINKS) {
    docs.push({
      id: `impact:${l.driver}`, title: `Impact Engine — ${l.scenario}`, scope: "public", keys: [l.driver, "impacto", "beneficiar", "afeta", ...tokens(l.driverLabel)], url: "/impacto", asOf: null, source: l.sources.join("; "),
      body: `${l.scenario}: ${l.explanation} Efeitos: ${l.effects.map((e) => `${e.target} (${e.direction}: ${e.channel})`).join("; ")}. Contrapontos: ${l.counterfactors.join("; ")}. Incerteza ${l.uncertainty}. ${l.limitations}`,
    });
  }
  const funds = getFunds().funds;
  const byTag = (t: string) => funds.filter((f) => f.tags.includes(t));
  for (const t of ["ouro", "dolar", "petroleo", "agro", "acucar", "cafe", "metais", "commodities", "macro"]) {
    const list = byTag(t).slice(0, 12);
    if (!list.length) continue;
    docs.push({
      id: `funds:${t}`, title: `Fundos com tema "${t}" (cadastro CVM)`, scope: "public", keys: ["fundos", "fundo", t, t === "dolar" ? "cambial" : ""], url: "/beneficiarios", asOf: getFunds().ingestedAt?.slice(0, 10) ?? null, source: "CVM — cadastro de fundos e informe diário",
      body: `Fundos cujo nome/classe indicam o tema ${t}: ` + list.map((f) => `${f.name} (CNPJ ${f.cnpj}; ${f.vehicle}; PL ${fmtCompact(f.netAssets)}; 12m ${fmtPct(f.performance?.return12m ?? null)}; ${f.holdings ? `carteira CDA ${monthLabel(f.holdings.month)} verificada` : "carteira não verificada"})`).join("; ") + ". O nome não garante a exposição: veja a carteira verificada de cada fundo. Fiagros investem em crédito/imóveis do agro e não têm exposição direta a preços agrícolas.",
    });
  }
  for (const f of funds.filter((x) => x.holdings)) {
    const h = f.holdings!;
    const ex = Object.entries(h.exposures).map(([c, e]) => e.weight !== null ? `${c} ${fmtPct(e.weight, 1, false)} (${e.via.join(", ")})` : `${c}: futuros ${e.side === "long" ? "comprados" : "vendidos"} (tamanho não divulgado)`).join("; ");
    docs.push({
      id: `fund:${f.cnpjDigits}`, title: `Carteira do fundo ${f.name}`, scope: "public", keys: ["fundo", "carteira", f.cnpjDigits, ...tokens(f.name)], url: `/fundos/${f.cnpjDigits}`, asOf: h.month, source: "CVM — Composição e Diversificação das Aplicações (CDA)",
      body: `${f.name} (CNPJ ${f.cnpj}, ${f.vehicle}). Carteira declarada à CVM em ${monthLabel(h.month)}: patrimônio ${fmtCompact(h.pl)}; parcela confidencial ${fmtPct(h.confidentialShare, 1, false)}. Exposição a commodities/câmbio: ${ex || "nenhuma relevante"}. Maiores posições: ${h.top.slice(0, 5).map((p) => `${p.label} ${fmtPct(p.weight, 1, false)}`).join("; ")}. A carteira muda mês a mês; não é recomendação.`,
    });
  }
  docs.push({
    id: "method:forecast", title: "Metodologia do Forecast Engine", scope: "public", keys: ["forecast", "previsao", "modelo", "metodologia", "futuros", "curva"], url: "/previsoes", asOf: getForecasts().generatedAt?.slice(0, 10) ?? null, source: "Avermont",
    body: "Modelos: passeio aleatório (baseline), drift, naive sazonal, suavização exponencial, ARIMA(1,1,1), Ridge, ensemble. Validação walk-forward sem vazamento; seleção na 1ª metade das origens e avaliação na 2ª; modelo só é publicado se superar o passeio aleatório no teste de Diebold-Mariano (p<0,05); intervalos de 80% por quantis empíricos dos erros. Curvas futuras de bolsa (cotações de contratos) são diferentes das previsões estatísticas e das expectativas Focus; cotações de contratos exigem licença e não estão integradas.",
  });
  for (const s of SOURCES) {
    docs.push({ id: `source:${s.id}`, title: `Fonte: ${s.provider}`, scope: "public", keys: [...tokens(s.provider), "fonte", "licenca", "dados"], url: "/fontes", asOf: null, source: s.provider, body: `${s.provider} — ${s.dataset}. Licença: ${s.licenseNote} Integração: ${s.integration}. Limitações: ${s.limitations}` });
  }
  cache = { key, docs };
  return docs;
}

/** Documentos privados do workspace (somente para membros). */
export async function workspaceDocs(workspaceId: string, workspaceName: string): Promise<Doc[]> {
  const docs: Doc[] = [];
  const mats = await query<{ name: string; unit: string; monthly_consumption: number; current_price: number; usd_share: number; commodity_id: string | null; inventory_qty: number }>("SELECT name, unit, monthly_consumption, current_price, usd_share, commodity_id, inventory_qty FROM workspace_materials WHERE workspace_id = $1", [workspaceId]);
  if (mats.length) {
    docs.push({
      id: "ws:materials", title: `Matérias-primas de ${workspaceName}`, scope: "workspace", keys: ["workspace", "materiais", "compras", "custo", ...mats.flatMap((m) => [m.commodity_id ?? "", ...tokens(m.name)])], url: "/business", asOf: null, source: "Dados confidenciais do seu workspace",
      body: mats.map((m) => `${m.name}: consumo ${fmtNumber(m.monthly_consumption, 1)} ${m.unit}/mês a R$ ${fmtNumber(m.current_price, 2)}/${m.unit} (gasto mensal R$ ${fmtNumber(m.monthly_consumption * m.current_price, 0)}; ${fmtNumber(m.usd_share, 0)}% atrelado ao dólar; estoque ${fmtNumber(m.inventory_qty, 1)} ${m.unit}; mercado de referência ${m.commodity_id ?? "nenhum"})`).join("; ") + ". Impacto de uma variação de preço = gasto mensal × variação × repasse (supondo consumo constante).",
    });
  }
  const quotes = await query<Parameters<typeof rankQuotes>[0][number] & { product: string; commodity_id: string | null }>("SELECT * FROM supplier_quotations WHERE workspace_id = $1", [workspaceId]);
  if (quotes.length) {
    const mp = marketParams();
    const ranked = rankQuotes(quotes, mp.fx, mp.rateMonthly);
    docs.push({
      id: "ws:quotes", title: `Cotações de fornecedores de ${workspaceName}`, scope: "workspace", keys: ["workspace", "cotacoes", "fornecedor", "fornecedores", "custo", "aquisicao", ...quotes.flatMap((q) => [q.commodity_id ?? "", ...tokens(q.supplier_name)])], url: "/business/fornecedores", asOf: null, source: "Dados confidenciais do seu workspace",
      body: "Ranking por custo total entregue (preço + frete + impostos + câmbio PTAX): " + ranked.slice(0, 10).map((r) => `#${r.rank} ${r.quote.supplier_name} — ${r.quote.product}: R$ ${fmtNumber(r.cost.perUnit, 2)}/${r.quote.unit} entregue (valor presente R$ ${fmtNumber(r.cost.pvPerUnit, 2)}; ${r.cost.eligible ? "elegível" : "inelegível: " + r.cost.warnings.join(", ")})`).join("; "),
    });
  }
  return docs;
}

export function retrieve(question: string, docs: Doc[], contextPath: string, k = 10): Doc[] {
  const qTokens = tokens(question);
  const expanded = new Set(qTokens);
  for (const t of qTokens) for (const s of SYN[t] ?? []) expanded.add(s);
  const pathKey = contextPath.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(tokens(d.title + " " + d.body))) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const scored = docs.map((d) => {
    const text = tokens(d.title + " " + d.body);
    const tf = new Map<string, number>();
    for (const t of text) tf.set(t, (tf.get(t) ?? 0) + 1);
    let s = 0;
    for (const t of expanded) {
      const f = tf.get(t) ?? 0;
      if (f) s += (Math.log(1 + N / (df.get(t) ?? 1)) * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * text.length / 120));
      if (d.keys.includes(t)) s += 4;
    }
    if (pathKey && d.keys.includes(pathKey)) s += 6;
    if (d.scope === "workspace" && (contextPath.startsWith("/business") || expanded.has("workspace"))) s += 5;
    return { d, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.d);
}
