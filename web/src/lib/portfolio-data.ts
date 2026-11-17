import "server-only";
import { query } from "./db";
import { findFund, getForecasts, getMacro, getSummaryItem } from "./market";
import { projectPortfolio, selicFactor, valuePositions, type HorizonChange, type Position, type PriceQuote, type ValuedPosition } from "./portfolio";

export const BRL_CURRENCIES = ["usdbrl", "eurbrl", "cnybrl"] as const;
const today = () => new Date().toISOString().slice(0, 10);

export function quoteFor(p: Position): PriceQuote {
  switch (p.asset_type) {
    case "currency": {
      const it = getSummaryItem(p.asset_ref);
      return { price: it?.stats?.last ?? null, date: it?.stats?.lastDate ?? null, source: it?.source?.label ?? "—", stale: !!it?.stats?.stale };
    }
    case "commodity": {
      const it = getSummaryItem(p.asset_ref);
      const usd = getSummaryItem("usdbrl")?.stats?.last;
      if (!it || it.dataMode !== "real" || !it.stats?.last || !usd) return { price: null, date: null, source: "—", stale: true, note: "Commodity sem preço real disponível" };
      return { price: it.stats.last * usd, date: it.stats.lastDate, source: `${it.source?.label} × PTAX`, stale: !!it.stats.stale, note: "Preço internacional (US$) convertido pela PTAX atual — exposição teórica ao benchmark" };
    }
    case "fund": {
      const f = findFund(p.asset_ref);
      if (!f?.performance) return { price: null, date: null, source: "CVM", stale: true, note: "Fundo sem cota no informe diário da CVM (ETFs e Fiagros não publicam)" };
      const age = (Date.now() - new Date(f.performance.quotaDate).getTime()) / 86400000;
      return { price: f.performance.quota, date: f.performance.quotaDate, source: "CVM — informe diário", stale: age > 7 };
    }
    case "stock":
      return p.manual_price
        ? { price: p.manual_price, date: p.manual_price_date, source: "Preço informado por você", stale: !p.manual_price_date || (Date.now() - new Date(p.manual_price_date).getTime()) / 86400000 > 3, note: "Cotações da B3 exigem licença; atualize o preço manualmente" }
        : { price: p.entry_price, date: p.entry_date, source: "Preço de entrada (sem atualização)", stale: true, note: "Informe o preço atual da ação" };
    case "cash": {
      const pts = (getMacro().indicators["selic-meta"]?.points ?? []) as [string, number][];
      const f = selicFactor(pts, p.entry_date, today());
      return { price: p.entry_price * f, date: pts[pts.length - 1]?.[0] ?? null, source: "Selic meta (BCB) — aproximação do CDI", stale: false, note: "Rendimento aproximado pela Selic meta (base 252)" };
    }
  }
}

const HMAP: Record<string, string> = { "30d": "30d", "90d": "90d", "180d": "180d" };

export function changeFor(p: ValuedPosition, horizon: "30d" | "90d" | "180d"): HorizonChange | null {
  const fcs = getForecasts().forecasts;
  if (p.asset_type === "currency" || p.asset_type === "commodity") {
    const f = fcs[p.asset_ref]?.horizons[HMAP[horizon]];
    if (!f || f.status !== "ok" || !f.central) return null;
    const o = fcs[p.asset_ref].origin.value;
    let c = { central: f.central / o - 1, low: f.low! / o - 1, high: f.high! / o - 1 };
    if (p.asset_type === "commodity") {
      // Commodity em R$: combina previsão da commodity (US$) e do câmbio
      const fx = fcs["usdbrl"]?.horizons[HMAP[horizon]];
      if (fx?.status === "ok" && fx.central) {
        const fo = fcs["usdbrl"].origin.value;
        c = { central: (1 + c.central) * (fx.central / fo) - 1, low: (1 + c.low) * (fx.low! / fo) - 1, high: (1 + c.high) * (fx.high! / fo) - 1 };
      }
    }
    return c;
  }
  if (p.asset_type === "cash") {
    // CDI projetado pela mediana do Focus para a Selic do ano (expectativa de mercado, não previsão Avermont)
    const focus = getMacro().focus?.items.find((i) => i.Indicador === "Selic" && i.DataReferencia === String(new Date().getFullYear() + (horizon === "180d" ? 1 : 0)));
    const sel = focus?.Mediana ?? getMacro().indicators["selic-meta"]?.points.at(-1)?.[1];
    if (!sel) return null;
    const days = horizon === "30d" ? 21 : horizon === "90d" ? 63 : 126;
    const g = Math.pow(1 + sel / 100, days / 252) - 1;
    return { central: g, low: g, high: g };
  }
  return null;
}

export interface PortfolioView {
  id: string; name: string; created_at: string; positions: ValuedPosition[]; total: number; invested: number; missing: number;
  snapshots: { snapshot_date: string; total_value: number; invested_value: number }[];
  projection: Record<"30d" | "90d" | "180d", ReturnType<typeof projectPortfolio>>;
}

export async function loadPortfolios(userId: string): Promise<PortfolioView[]> {
  const pfs = await query<{ id: string; name: string; created_at: string }>("SELECT id, name, created_at FROM portfolios WHERE user_id = $1 ORDER BY created_at", [userId]);
  const out: PortfolioView[] = [];
  for (const pf of pfs) {
    const pos = await query<Position>("SELECT id, asset_type, asset_ref, label, quantity, entry_price, entry_date, manual_price, manual_price_date FROM portfolio_positions WHERE portfolio_id = $1 ORDER BY created_at", [pf.id]);
    const v = valuePositions(pos, quoteFor);
    await snapshot(pf.id, v);
    const snaps = await query<{ snapshot_date: string; total_value: number; invested_value: number }>("SELECT snapshot_date, total_value, invested_value FROM portfolio_snapshots WHERE portfolio_id = $1 ORDER BY snapshot_date", [pf.id]);
    out.push({
      ...pf, ...v, snapshots: snaps,
      projection: {
        "30d": projectPortfolio(v.positions, (p) => changeFor(p, "30d")),
        "90d": projectPortfolio(v.positions, (p) => changeFor(p, "90d")),
        "180d": projectPortfolio(v.positions, (p) => changeFor(p, "180d")),
      },
    });
  }
  return out;
}

/** Grava (ou atualiza durante o dia) o snapshot de hoje. Dias anteriores permanecem como registrados. */
export async function snapshot(portfolioId: string, v: ReturnType<typeof valuePositions>) {
  const breakdown = v.positions.map((p) => ({ ref: p.asset_ref, type: p.asset_type, value: p.value, price: p.price, priceDate: p.priceDate }));
  await query(
    `INSERT INTO portfolio_snapshots (portfolio_id, snapshot_date, total_value, invested_value, breakdown) VALUES ($1, current_date, $2, $3, $4)
     ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET total_value = EXCLUDED.total_value, invested_value = EXCLUDED.invested_value, breakdown = EXCLUDED.breakdown, created_at = now()`,
    [portfolioId, v.total, v.invested, JSON.stringify(breakdown)],
  );
}

/** Snapshot diário de todas as carteiras (chamado pelo agendador). */
export async function snapshotAll(): Promise<number> {
  const pfs = await query<{ id: string }>("SELECT id FROM portfolios");
  for (const pf of pfs) {
    const pos = await query<Position>("SELECT id, asset_type, asset_ref, label, quantity, entry_price, entry_date, manual_price, manual_price_date FROM portfolio_positions WHERE portfolio_id = $1", [pf.id]);
    await snapshot(pf.id, valuePositions(pos, quoteFor));
  }
  return pfs.length;
}
