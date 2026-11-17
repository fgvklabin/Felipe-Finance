import "server-only";
import { COMPANY_KB } from "./companies-kb";
import { IMPACT_LINKS } from "./impact";
import { getCompanies, getFunds, type CvmCompany, type Fund } from "./market";

// Quem tende a se beneficiar de uma ALTA no preço de cada commodity (efeito de primeira ordem).
// Não é recomendação: o efeito líquido depende de hedge, câmbio, custos, volumes e expectativas já precificadas.

export const TAG_LABEL: Record<string, string> = { ouro: "Ouro", petroleo: "Petróleo", energia: "Energia", agro: "Agro", acucar: "Açúcar", cafe: "Café", metais: "Metais", commodities: "Commodities", dolar: "Dólar", emergentes: "Moedas emergentes", macro: "Macro global" };

export const EXPOSURE_LABEL: Record<string, { label: string; tone: "green" | "blue" | "gold" | "neutral" | "purple" }> = {
  direta_indice: { label: "Direta (fundo de índice)", tone: "green" },
  direta_cambial: { label: "Direta (câmbio)", tone: "green" },
  indireta_acoes: { label: "Indireta via ações", tone: "blue" },
  credito_ou_imoveis_agro: { label: "Fiagro: crédito/imóveis", tone: "purple" },
  multimercado_nao_verificada: { label: "Multimercado (não verificada)", tone: "gold" },
};

// Temas de fundos (inferidos do nome/classe CVM) → commodities cuja alta os afeta diretamente.
const TAG_TO_COMMODITIES: Record<string, string[]> = {
  ouro: ["ouro"],
  petroleo: ["brent", "wti"],
  energia: ["brent", "wti", "gas-natural", "gas-natural-eu"],
  acucar: ["acucar"],
  cafe: ["cafe-arabica", "cafe-robusta"],
  metais: ["minerio-ferro", "cobre", "aluminio", "zinco", "niquel", "estanho", "aco", "prata", "platina"],
  agro: ["soja", "milho", "trigo", "algodao", "farelo-soja", "oleo-soja", "acucar", "cafe-arabica", "cafe-robusta", "sorgo"],
};

export interface StockBeneficiary {
  ticker: string; tickers: string[]; name: string; sector: string | null; strength: "direta" | "mista";
  channels: string[]; offsets: string[]; company: CvmCompany | null;
}

export interface FundBeneficiary { fund: Fund; basis: "direta" | "indireta" | "nao_verificada"; matchedTags: string[] }

export function stocksFor(commodityId: string): StockBeneficiary[] {
  const map = new Map<string, StockBeneficiary>();
  const companies = getCompanies().companies;
  const add = (ticker: string, strength: "direta" | "mista", channel: string) => {
    const kb = COMPANY_KB.find((k) => k.tickers.includes(ticker));
    const co = companies.find((c) => c.tickersGiven.includes(ticker)) ?? null;
    const key = kb?.tickers[0] ?? ticker;
    const cur = map.get(key);
    if (cur) {
      if (!cur.channels.includes(channel)) cur.channels.push(channel);
      if (strength === "direta") cur.strength = "direta";
      return;
    }
    map.set(key, {
      ticker: key, tickers: kb?.tickers ?? [ticker], name: kb?.shortName ?? co?.name ?? ticker, sector: co?.sector ?? kb?.segment ?? null,
      strength, channels: [channel], offsets: kb?.offsets ?? [], company: co,
    });
  };
  for (const k of COMPANY_KB) {
    for (const e of k.commodityExposure) {
      if (e.commodity !== commodityId) continue;
      if (e.direction === "receita") add(k.tickers[0], "direta", e.note);
      if (e.direction === "misto") add(k.tickers[0], "mista", e.note);
    }
  }
  for (const l of IMPACT_LINKS.filter((x) => x.driver === commodityId)) {
    for (const e of l.effects) {
      if (!e.ref) continue;
      if (e.direction === "positive") add(e.ref, "direta", e.channel);
      if (e.direction === "mixed") add(e.ref, "mista", e.channel);
    }
  }
  return [...map.values()].sort((a, b) => (a.strength === b.strength ? a.ticker.localeCompare(b.ticker) : a.strength === "direta" ? -1 : 1));
}

export function fundsFor(commodityId: string): FundBeneficiary[] {
  const out: FundBeneficiary[] = [];
  for (const f of getFunds().funds) {
    const matched = f.tags.filter((t) => TAG_TO_COMMODITIES[t]?.includes(commodityId));
    if (!matched.length) continue;
    // Fiagros (crédito/imóveis) e fundos cambiais não têm exposição direta ao preço da commodity: ficam de fora.
    if (f.vehicle === "fiagro" || f.vehicle === "cambial") continue;
    const basis = f.vehicle === "etf" ? "direta" : f.vehicle === "acoes" ? "indireta" : "nao_verificada";
    out.push({ fund: f, basis, matchedTags: matched });
  }
  const rank = { direta: 0, indireta: 1, nao_verificada: 2 } as const;
  return out.sort((a, b) => rank[a.basis] - rank[b.basis] || b.fund.netAssets - a.fund.netAssets);
}

export function beneficiaryCounts(commodityId: string) {
  return { stocks: stocksFor(commodityId).length, funds: fundsFor(commodityId).filter((f) => f.basis !== "nao_verificada").length };
}
