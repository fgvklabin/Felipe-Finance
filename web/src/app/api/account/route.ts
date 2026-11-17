import { z } from "zod";
import { HttpError, handler, json, limit, parseBody, requireApiUser } from "@/lib/api";
import { destroySession, hashPassword, validatePassword, verifyPassword } from "@/lib/auth";
import { audit, one, query, tx } from "@/lib/db";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile"), name: z.string().trim().min(2).max(120), locale: z.enum(["pt", "en"]) }),
  z.object({ action: z.literal("notifications"), inApp: z.boolean(), email: z.boolean() }),
  z.object({ action: z.literal("password"), current: z.string().min(1).max(200), next: z.string().min(1).max(200) }),
  z.object({ action: z.literal("delete"), password: z.string().min(1).max(200), confirm: z.literal("EXCLUIR") }),
  z.object({ action: z.literal("feedback"), message: z.string().trim().min(3).max(4000), rating: z.number().int().min(1).max(5).nullable().optional(), page: z.string().max(200).optional() }),
]);

/** GET: exportação completa dos dados pessoais e dos workspaces em que o usuário é proprietário/admin (portabilidade, LGPD art. 18). */
export const GET = handler("account/export", async () => {
  const u = await requireApiUser();
  await limit(`export:${u.id}`, 5, 60 * 60_000);
  const ws = await query<{ workspace_id: string; role: string }>("SELECT workspace_id, role FROM workspace_members WHERE user_id = $1", [u.id]);
  const ownedWs = ws.filter((w) => w.role === "owner" || w.role === "admin").map((w) => w.workspace_id);
  const data = {
    exportedAt: new Date().toISOString(),
    user: await one("SELECT id, email, name, account_type, locale, notification_prefs, onboarding, lgpd_consent_at, created_at, last_login_at FROM users WHERE id = $1", [u.id]),
    watchlists: await query("SELECT w.name, i.item_type, i.item_ref, i.created_at FROM watchlists w LEFT JOIN watchlist_items i ON i.watchlist_id = w.id WHERE w.user_id = $1", [u.id]),
    alerts: await query("SELECT alert_type, item_type, item_ref, threshold, channels, active, created_at FROM alerts WHERE user_id = $1", [u.id]),
    notifications: await query("SELECT title, body, link, read_at, created_at FROM notifications WHERE user_id = $1", [u.id]),
    aiConversations: await query("SELECT c.id, c.title, c.created_at, m.role, m.content, m.created_at AS message_at FROM ai_conversations c JOIN ai_messages m ON m.conversation_id = c.id WHERE c.user_id = $1 ORDER BY c.id, m.id", [u.id]),
    portfolios: await query("SELECT p.name, x.asset_type, x.asset_ref, x.label, x.quantity, x.entry_price, x.entry_date FROM portfolios p LEFT JOIN portfolio_positions x ON x.portfolio_id = p.id WHERE p.user_id = $1", [u.id]),
    workspaces: await Promise.all(ownedWs.map(async (id) => ({
      id,
      materials: await query("SELECT * FROM workspace_materials WHERE workspace_id = $1", [id]),
      quotations: await query("SELECT * FROM supplier_quotations WHERE workspace_id = $1", [id]),
      purchases: await query("SELECT * FROM procurement_history WHERE workspace_id = $1", [id]),
      purchaseRequests: await query("SELECT * FROM purchase_requests WHERE workspace_id = $1", [id]),
    }))),
  };
  await audit(u.id, "account.export", "user", u.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="avermont-meus-dados-${new Date().toISOString().slice(0, 10)}.json"` },
  });
});

export const POST = handler("account", async (req) => {
  const u = await requireApiUser();
  const b = await parseBody(req, Body);
  switch (b.action) {
    case "profile":
      await query("UPDATE users SET name = $2, locale = $3 WHERE id = $1", [u.id, b.name, b.locale]);
      return json({ ok: true });
    case "notifications":
      await query("UPDATE users SET notification_prefs = $2 WHERE id = $1", [u.id, JSON.stringify({ inApp: b.inApp, email: b.email, whatsapp: false })]);
      return json({ ok: true });
    case "password": {
      await limit(`pw:${u.id}`, 10, 60 * 60_000);
      const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id]);
      if (!row || !(await verifyPassword(b.current, row.password_hash))) throw new HttpError(401, "Senha atual incorreta.");
      const err = validatePassword(b.next);
      if (err) throw new HttpError(422, err);
      await query("UPDATE users SET password_hash = $2 WHERE id = $1", [u.id, await hashPassword(b.next)]);
      await audit(u.id, "user.password_change", "user", u.id);
      return json({ ok: true });
    }
    case "feedback":
      await query("INSERT INTO feedback (user_id, page, rating, message) VALUES ($1, $2, $3, $4)", [u.id, b.page ?? null, b.rating ?? null, b.message]);
      return json({ ok: true }, 201);
    case "delete": {
      const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id]);
      if (!row || !(await verifyPassword(b.password, row.password_hash))) throw new HttpError(401, "Senha incorreta.");
      await tx(async (q) => {
        // Workspaces em que o usuário é o único membro são apagados (dados confidenciais da empresa)
        await q.query("DELETE FROM workspaces w WHERE EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = $1) AND (SELECT count(*) FROM workspace_members m2 WHERE m2.workspace_id = w.id) = 1", [u.id]);
        await q.query("DELETE FROM workspace_members WHERE user_id = $1", [u.id]);
        for (const t of ["watchlists", "alerts", "notifications", "ai_conversations", "portfolios", "sessions", "password_resets"]) await q.query(`DELETE FROM ${t} WHERE user_id = $1`, [u.id]);
        // Anonimização do registro (mantido apenas para integridade de auditoria)
        await q.query("UPDATE users SET email = $2, name = 'Conta excluída', password_hash = '!', status = 'deleted', notification_prefs = '{}', onboarding = '{}' WHERE id = $1", [u.id, `excluido+${u.id}@avermont.invalid`]);
      });
      await audit(u.id, "user.delete", "user", u.id);
      await destroySession();
      return json({ ok: true });
    }
  }
});
