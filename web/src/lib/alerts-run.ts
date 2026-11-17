import "server-only";
import { query } from "./db";
import { sendEmail, appUrl } from "./email";
import { evaluateAlert, type AlertRow, type MarketView } from "./alerts";
import { findFund, getCompanies, getForecasts, getSummaryItem } from "./market";
import { marketNotes } from "./insights";

export function marketView(): MarketView {
  const notes = marketNotes();
  return {
    price(ref) {
      const it = getSummaryItem(ref);
      if (!it?.stats?.last || it.dataMode !== "real") return null;
      return { value: it.stats.last, date: it.stats.lastDate, d1: it.stats.changes.d1, m1: it.stats.changes.m1, frequency: it.frequency ?? "monthly", name: it.name.pt };
    },
    forecastDirection(ref) {
      const h = getForecasts().forecasts[ref]?.horizons["30d"];
      return h ? { direction: h.direction ?? "n/a", status: h.status, central: h.central ?? null } : null;
    },
    latestFiscalYear(t) {
      const c = getCompanies().companies.find((x) => x.tickersGiven.includes(t));
      return c?.financials.at(-1)?.fiscalYear ?? null;
    },
    fundExposure(cnpj) {
      const f = findFund(cnpj);
      if (!f) return null;
      if (!f.holdings) return f.exposureType;
      // Assinatura: commodities com ≥5% da carteira e direção dos futuros (muda quando o fundo entra/sai de um tema)
      const sig = Object.entries(f.holdings.exposures)
        .filter(([, e]) => (e.weight !== null && Math.abs(e.weight) >= 0.05) || e.weight === null)
        .map(([c, e]) => (e.weight === null ? `${c} (futuros ${e.side === "long" ? "comprados" : "vendidos"})` : c))
        .sort();
      return sig.length ? `carteira: ${sig.join(", ")}` : "carteira sem exposição relevante a commodities";
    },
    latestNoteDate(ref) {
      const n = notes.find((x) => x.relatedCommodities.includes(ref) || x.relatedCompanies.includes(ref) || x.id.endsWith(ref));
      return n ? { date: n.date, title: n.title } : null;
    },
  };
}

/** Avalia alertas ativos (de um usuário ou de todos) e gera notificações in-app e e-mails. */
export async function runAlerts(userId?: string) {
  const rows = await query<AlertRow & { user_id: string; channels: string[]; email: string; notification_prefs: { email?: boolean } }>(
    `SELECT a.id, a.alert_type, a.item_type, a.item_ref, a.threshold, a.last_state, a.user_id, a.channels, u.email, u.notification_prefs
       FROM alerts a JOIN users u ON u.id = a.user_id WHERE a.active AND u.status = 'active' ${userId ? "AND a.user_id = $1" : ""}`,
    userId ? [userId] : [],
  );
  const view = marketView();
  let fired = 0;
  for (const a of rows) {
    const r = evaluateAlert(a, view);
    await query("UPDATE alerts SET last_state = $2, last_value = $3, last_triggered_at = CASE WHEN $4 THEN now() ELSE last_triggered_at END WHERE id = $1", [a.id, JSON.stringify(r.state), r.value, r.triggered]);
    if (!r.triggered) continue;
    fired++;
    const link = a.item_type === "currency" ? `/moedas/${a.item_ref}` : a.item_type === "commodity" ? `/commodity/${a.item_ref}` : a.item_type === "company" ? `/empresas/${a.item_ref}` : a.item_type === "fund" ? `/fundos/${a.item_ref}` : "/alertas";
    if (a.channels.includes("in_app")) await query("INSERT INTO notifications (user_id, alert_id, title, body, link) VALUES ($1, $2, $3, $4, $5)", [a.user_id, a.id, r.title, r.body, link]);
    if (a.channels.includes("email") && a.notification_prefs?.email) await sendEmail(a.email, `Avermont — ${r.title}`, `${r.body}\n\n${appUrl(link)}`);
  }
  return { evaluated: rows.length, fired };
}
