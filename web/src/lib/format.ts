// Formatação numérica e de datas no padrão brasileiro (com fallback em inglês).

export type Locale = "pt" | "en";

const loc = (l: Locale) => (l === "en" ? "en-US" : "pt-BR");

export function fmtNumber(v: number | null | undefined, digits = 2, l: Locale = "pt"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(loc(l), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

/** Casas decimais adequadas à magnitude do preço. */
export function fmtPrice(v: number | null | undefined, l: Locale = "pt"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : 4;
  return fmtNumber(v, d, l);
}

export function fmtPct(v: number | null | undefined, digits = 1, signed = true, l: Locale = "pt"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = new Intl.NumberFormat(loc(l), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v * 100);
  return `${signed && v > 0 ? "+" : ""}${s}%`;
}

export function fmtMoney(v: number | null | undefined, currency = "BRL", l: Locale = "pt", digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(loc(l), { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

/** Valores grandes: R$ 1,2 bi / R$ 350,4 mi */
export function fmtCompact(v: number | null | undefined, prefix = "R$ ", l: Locale = "pt"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const units: [number, string, string][] = [
    [1e12, " tri", " T"],
    [1e9, " bi", " B"],
    [1e6, " mi", " M"],
    [1e3, " mil", " K"],
  ];
  for (const [n, pt, en] of units) {
    if (a >= n) return `${v < 0 ? "-" : ""}${prefix}${fmtNumber(a / n, 1, l)}${l === "en" ? en : pt}`;
  }
  return `${prefix}${fmtNumber(v, 0, l)}`;
}

export function fmtDate(iso: string | null | undefined, l: Locale = "pt", opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(loc(l), opts ?? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}

export function fmtMonth(iso: string | null | undefined, l: Locale = "pt"): string {
  return fmtDate(iso, l, { month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(iso: string | null | undefined, l: Locale = "pt"): string {
  return fmtDate(iso, l, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function changeClass(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return "text-muted";
  return v > 0 ? "text-up" : "text-down";
}
