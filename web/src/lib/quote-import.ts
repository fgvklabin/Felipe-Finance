// Importação de cotações de planilhas (CSV/Excel): parsing, mapeamento de colunas e normalização.

export interface DraftQuote {
  supplier_name: string; product: string; specification: string | null; unit: string; quantity: number | null; unit_price: number | null;
  currency: "BRL" | "USD" | "EUR"; freight_total: number; tax_pct: number; payment_days: number; delivery_days: number | null;
  delivery_location: string | null; min_order_qty: number | null; valid_until: string | null; contact: string | null; commodity_id: string | null;
  verified: boolean; source: "manual" | "csv" | "xlsx" | "pdf_ai" | "image_ai"; evidence?: string | null; issues: string[];
}

const ALIASES: Record<keyof Omit<DraftQuote, "verified" | "source" | "issues" | "evidence" | "commodity_id">, string[]> = {
  supplier_name: ["fornecedor", "supplier", "empresa", "razao social", "vendedor"],
  product: ["produto", "product", "item", "material", "descricao"],
  specification: ["especificacao", "spec", "specification", "qualidade", "padrao"],
  unit: ["unidade", "unit", "un", "um"],
  quantity: ["quantidade", "qtd", "quantity", "volume"],
  unit_price: ["preco unitario", "preco", "price", "unit price", "valor unitario", "preco/un"],
  currency: ["moeda", "currency"],
  freight_total: ["frete", "freight", "frete total"],
  tax_pct: ["impostos %", "impostos", "tax", "tax %", "aliquota"],
  payment_days: ["prazo pagamento", "pagamento", "payment days", "prazo (dias)", "condicao pagamento"],
  delivery_days: ["prazo entrega", "entrega (dias)", "delivery days", "lead time"],
  delivery_location: ["local entrega", "local", "delivery location", "destino"],
  min_order_qty: ["pedido minimo", "minimo", "moq", "min order"],
  valid_until: ["validade", "valid until", "valida ate"],
  contact: ["contato", "contact", "email", "telefone"],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Parser CSV com suporte a aspas e detecção de separador (; ou ,). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Número em formato brasileiro ou internacional ("1.234,56", "1,234.56", "R$ 1.200"). */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function mapRows(rows: unknown[][], source: "csv" | "xlsx"): DraftQuote[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => norm(String(h ?? "")));
  const idx = {} as Record<keyof typeof ALIASES, number>;
  (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).forEach((k) => {
    idx[k] = header.findIndex((h) => ALIASES[k].some((a) => h === a || h.startsWith(a)));
  });
  return rows.slice(1).map((r) => {
    const get = (k: keyof typeof ALIASES) => (idx[k] >= 0 ? r[idx[k]] : null);
    const cur = norm(String(get("currency") ?? "brl")).toUpperCase();
    const d: DraftQuote = {
      supplier_name: String(get("supplier_name") ?? "").trim(),
      product: String(get("product") ?? "").trim(),
      specification: get("specification") ? String(get("specification")) : null,
      unit: String(get("unit") ?? "t").trim() || "t",
      quantity: parseNumber(get("quantity")),
      unit_price: parseNumber(get("unit_price")),
      currency: cur.includes("USD") || cur.includes("US$") ? "USD" : cur.includes("EUR") ? "EUR" : "BRL",
      freight_total: parseNumber(get("freight_total")) ?? 0,
      tax_pct: parseNumber(get("tax_pct")) ?? 0,
      payment_days: Math.round(parseNumber(get("payment_days")) ?? 0),
      delivery_days: parseNumber(get("delivery_days")),
      delivery_location: get("delivery_location") ? String(get("delivery_location")) : null,
      min_order_qty: parseNumber(get("min_order_qty")),
      valid_until: parseDate(get("valid_until")),
      contact: get("contact") ? String(get("contact")) : null,
      commodity_id: null, verified: false, source, issues: [],
    };
    d.issues = validateDraft(d);
    return d;
  });
}

export function validateDraft(d: DraftQuote): string[] {
  const out: string[] = [];
  if (!d.supplier_name) out.push("fornecedor ausente");
  if (!d.product) out.push("produto ausente");
  if (!d.quantity || d.quantity <= 0) out.push("quantidade inválida");
  if (!d.unit_price || d.unit_price <= 0) out.push("preço inválido");
  if (d.tax_pct < 0 || d.tax_pct > 100) out.push("impostos fora de 0–100%");
  return out;
}

export const CSV_TEMPLATE =
  "fornecedor;produto;especificacao;unidade;quantidade;preco unitario;moeda;frete;impostos %;prazo pagamento;prazo entrega;local entrega;pedido minimo;validade;contato\n";
