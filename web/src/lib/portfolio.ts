// Carteira personalizada (educacional): valorização diária e projeção. Funções puras — testadas.

export type AssetType = "currency" | "commodity" | "stock" | "fund" | "cash";

export interface Position {
  id: string; asset_type: AssetType; asset_ref: string; label: string; quantity: number; entry_price: number; entry_date: string;
  manual_price: number | null; manual_price_date: string | null;
}

export interface PriceQuote { price: number | null; date: string | null; source: string; stale: boolean; note?: string }

export interface ValuedPosition extends Position {
  price: number | null; priceDate: string | null; source: string; stale: boolean; note?: string;
  value: number | null; invested: number; pnl: number | null; pnlPct: number | null;
}

export function valuePositions(positions: Position[], quote: (p: Position) => PriceQuote): { positions: ValuedPosition[]; total: number; invested: number; missing: number } {
  let total = 0, invested = 0, missing = 0;
  const out = positions.map((p) => {
    const q = quote(p);
    const inv = p.quantity * p.entry_price;
    const value = q.price !== null ? p.quantity * q.price : null;
    invested += inv;
    if (value === null) missing++;
    else total += value;
    return { ...p, price: q.price, priceDate: q.date, source: q.source, stale: q.stale, note: q.note, value, invested: inv, pnl: value !== null ? value - inv : null, pnlPct: value !== null && inv ? value / inv - 1 : null };
  });
  return { positions: out, total, invested, missing };
}

/** Fator de capitalização pela Selic diária (base 252) entre duas datas, usando a série de metas vigentes. */
export function selicFactor(points: [string, number][], from: string, to: string): number {
  let f = 1;
  for (const [d, rate] of points) {
    if (d <= from || d > to) continue;
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    f *= Math.pow(1 + rate / 100, 1 / 252);
  }
  return f;
}

export interface HorizonChange { central: number; low: number; high: number }

/**
 * Projeção por horizonte: soma das posições projetadas. A faixa é conservadora (supõe que todos os ativos
 * se movem para o mesmo lado simultaneamente) — não é um intervalo de confiança da carteira.
 */
export function projectPortfolio(positions: ValuedPosition[], changeFor: (p: ValuedPosition) => HorizonChange | null) {
  let central = 0, low = 0, high = 0, covered = 0, uncovered = 0;
  for (const p of positions) {
    if (p.value === null) continue;
    const c = changeFor(p);
    if (c) {
      central += p.value * (1 + c.central);
      low += p.value * (1 + Math.min(c.low, c.high));
      high += p.value * (1 + Math.max(c.low, c.high));
      covered += p.value;
    } else {
      central += p.value; low += p.value; high += p.value;
      uncovered += p.value;
    }
  }
  return { central, low, high, covered, uncovered };
}
