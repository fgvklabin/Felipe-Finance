import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { query, one } from "@/lib/db";
import { currentWorkspace } from "@/lib/business";
import { runAlerts } from "@/lib/alerts-run";

const Create = z.object({
  action: z.literal("create"),
  alert_type: z.enum(["price_above", "price_below", "pct_change_up", "pct_change_down", "fx_move", "forecast_change", "new_quote", "news", "company_results", "fund_exposure"]),
  item_type: z.enum(["commodity", "currency", "company", "fund", "workspace"]),
  item_ref: z.string().min(1).max(40),
  threshold: z.coerce.number().finite().nullable().optional(),
  channels: z.array(z.enum(["in_app", "email"])).min(1).default(["in_app"]),
});
const Body = z.discriminatedUnion("action", [
  Create,
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("toggle"), id: z.string().uuid() }),
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("read_all") }),
]);

export const POST = handler("alerts", async (req) => {
  const u = await requireApiUser();
  const b = await parseBody(req, Body);
  switch (b.action) {
    case "create": {
      const needsThreshold = ["price_above", "price_below", "pct_change_up", "pct_change_down", "fx_move"].includes(b.alert_type);
      if (needsThreshold && (b.threshold === null || b.threshold === undefined)) throw new HttpError(422, "Informe o valor de referência do alerta.");
      let ws: string | null = null;
      if (b.alert_type === "new_quote") {
        const m = await currentWorkspace(u);
        if (!m) throw new HttpError(422, "Alertas de cotação exigem um workspace empresarial.");
        ws = m.workspace_id;
      }
      const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM alerts WHERE user_id = $1", [u.id]);
      if ((n?.n ?? 0) >= 100) throw new HttpError(422, "Limite de 100 alertas.");
      const r = await one("INSERT INTO alerts (user_id, workspace_id, alert_type, item_type, item_ref, threshold, channels) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [u.id, ws, b.alert_type, b.item_type, b.item_ref, b.threshold ?? null, b.channels]);
      await runAlerts(u.id); // inicializa o estado (sem disparar retroativamente em mudanças)
      return json(r, 201);
    }
    case "delete":
      await query("DELETE FROM alerts WHERE id = $1 AND user_id = $2", [b.id, u.id]);
      return json({ ok: true });
    case "toggle":
      await query("UPDATE alerts SET active = NOT active WHERE id = $1 AND user_id = $2", [b.id, u.id]);
      return json({ ok: true });
    case "run":
      return json(await runAlerts(u.id));
    case "read_all":
      await query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [u.id]);
      return json({ ok: true });
  }
});
