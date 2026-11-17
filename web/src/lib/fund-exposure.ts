// Exposição de um fundo a uma commodity: verificada na carteira (CDA) quando disponível,
// senão inferida pelo nome/classe — sempre rotulada. Função pura (testada).
import type { Fund, FundHoldings } from "./market";

export type ExposureBasis = "carteira" | "derivativos" | "nome_indice" | "nome_acoes" | "nao_verificada";

export interface FundExposure {
  basis: ExposureBasis;
  weight: number | null; // peso total na carteira (inclui ações)
  directWeight: number | null; // exposição direta (ETF, exterior, cotas, outros ativos) — base dos cálculos
  stocksWeight: number | null; // via ações de produtoras — sem sensibilidade verificada
  month: string | null;
}

const TAG_TO: Record<string, string[]> = {
  ouro: ["ouro"], petroleo: ["brent", "wti"], energia: ["brent", "wti", "gas-natural", "gas-natural-eu"], acucar: ["acucar"],
  cafe: ["cafe-arabica", "cafe-robusta"], metais: ["minerio-ferro", "cobre", "aluminio", "zinco", "niquel", "estanho", "aco", "prata", "platina"],
  agro: ["soja", "milho", "trigo", "algodao", "farelo-soja", "oleo-soja", "acucar", "cafe-arabica", "cafe-robusta", "sorgo"],
};

export const MIN_WEIGHT = 0.05;

export function nameSuggests(f: Fund, commodity: string) {
  return f.tags.some((t) => TAG_TO[t]?.includes(commodity));
}

/** null = o fundo não deve aparecer como beneficiário da alta desta commodity. */
export function exposureFor(f: Fund, commodity: string): FundExposure | null {
  const h = f.holdings;
  if (h) {
    const e = h.exposures[commodity];
    if (!e) return null;
    if (e.weight === null) return e.side === "long" ? { basis: "derivativos", weight: null, directWeight: null, stocksWeight: null, month: h.month } : null;
    if (e.weight < MIN_WEIGHT) return null; // vendido ou exposição irrelevante
    const stocks = e.byVia?.["ações"] ?? 0;
    return { basis: "carteira", weight: e.weight, directWeight: Math.max(0, e.weight - stocks), stocksWeight: stocks || null, month: h.month };
  }
  if (!nameSuggests(f, commodity) || f.vehicle === "fiagro" || f.vehicle === "cambial") return null;
  const basis: ExposureBasis = f.vehicle === "etf" ? "nome_indice" : f.vehicle === "acoes" ? "nome_acoes" : "nao_verificada";
  return { basis, weight: null, directWeight: null, stocksWeight: null, month: null };
}

export const BASIS_LABEL: Record<ExposureBasis, { label: string; tone: "green" | "blue" | "gold" | "neutral" }> = {
  carteira: { label: "verificada na carteira", tone: "green" },
  derivativos: { label: "via futuros (comprado)", tone: "blue" },
  nome_indice: { label: "fundo de índice (pelo nome)", tone: "gold" },
  nome_acoes: { label: "fundo de ações (pelo nome)", tone: "gold" },
  nao_verificada: { label: "não verificada", tone: "neutral" },
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-10" → "out/2026" */
export function monthLabel(ym: string | null) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] ?? m}/${y}`;
}

const pct = (w: number) => `${(w * 100).toLocaleString("pt-BR", { maximumFractionDigits: w < 0.1 ? 1 : 0 })}%`;

/** Frase curta e simples para a exposição. */
export function exposureText(e: FundExposure) {
  if (e.basis === "carteira" && e.weight !== null) {
    const parts = [`${pct(e.weight)} da carteira`];
    if (e.stocksWeight && e.directWeight !== null && e.directWeight > 0.005) parts.push(`(${pct(e.stocksWeight)} em ações de produtoras)`);
    else if (e.stocksWeight) parts.push("(via ações de produtoras)");
    return `${parts.join(" ")} em ${monthLabel(e.month)}`;
  }
  if (e.basis === "derivativos") return `contratos futuros comprados em ${monthLabel(e.month)} (tamanho não divulgado)`;
  if (e.basis === "nome_indice") return "pelo nome do fundo — carteira ainda não verificada";
  if (e.basis === "nome_acoes") return "fundo de ações do setor, pelo nome — carteira ainda não verificada";
  return "só pelo nome — pode estar comprado, vendido ou protegido";
}

export interface FundSimExposure {
  month: string;
  direct: Record<string, number>; // commodity → peso direto (sem ações), já incluindo conversão para reais no cálculo
  usd: number; // peso no exterior/dólar além do que já está nas commodities acima
  stocks: number; // peso em ações de produtoras (sem sensibilidade verificada)
  futures: { commodity: string; side: "long" | "short" }[]; // tamanho desconhecido
}

/** Pesos usados pelo simulador. Evita contar o dólar duas vezes quando o ativo de commodity está no exterior. */
export function simExposure(h: FundHoldings | null | undefined): FundSimExposure | null {
  if (!h) return null;
  const direct: Record<string, number> = {};
  const futures: FundSimExposure["futures"] = [];
  let stocks = 0;
  const overlap: Record<string, number> = {};
  for (const [c, e] of Object.entries(h.exposures)) {
    if (e.weight === null) {
      futures.push({ commodity: c, side: e.side });
      continue;
    }
    if (c === "usdbrl") continue;
    const s = e.byVia?.["ações"] ?? 0;
    stocks += s;
    const d = e.weight - s;
    if (d > 0.0005) direct[c] = d;
    for (const v of ["exterior", "fundo investido"]) overlap[v] = (overlap[v] ?? 0) + (e.byVia?.[v] ?? 0);
  }
  const u = h.exposures.usdbrl;
  let usd = 0;
  if (u && u.weight !== null) {
    usd = u.weight;
    for (const v of ["exterior", "fundo investido"]) usd -= Math.min(u.byVia?.[v] ?? 0, overlap[v] ?? 0);
  }
  return { month: h.month, direct, usd: Math.max(0, usd), stocks, futures };
}
