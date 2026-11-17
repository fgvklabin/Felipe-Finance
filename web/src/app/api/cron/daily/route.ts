import { HttpError, handler, json } from "@/lib/api";
import { runAlerts } from "@/lib/alerts-run";
import { snapshotAll } from "@/lib/portfolio-data";
import { audit } from "@/lib/db";

// Tarefa diária (Vercel Cron, GitHub Actions ou qualquer agendador): avalia alertas e registra
// o snapshot diário das carteiras. Protegida por CRON_SECRET (Authorization: Bearer <segredo>).
export const GET = handler("cron/daily", async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Não autorizado.");
  const alerts = await runAlerts();
  const portfolios = await snapshotAll();
  await audit(null, "cron.daily", "system", null, { ...alerts, portfolios });
  return json({ ok: true, alerts, portfolios });
});
