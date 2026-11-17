import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { audit, one, query } from "@/lib/db";

type Ctx = { params: Promise<{ action: string }> };

export const POST = handler<Ctx>("admin/action", async (req, { params }) => {
  const { action } = await params;
  const admin = await requireApiUser();
  if (!admin.is_admin) throw new HttpError(403, "Apenas administradores.");
  switch (action) {
    case "user": {
      const b = await parseBody(req, z.object({ userId: z.string().uuid(), is_admin: z.boolean().optional(), status: z.enum(["active", "disabled"]).optional() }));
      if (b.userId === admin.id && (b.is_admin === false || b.status === "disabled")) throw new HttpError(422, "Você não pode remover seu próprio acesso.");
      const before = await one("SELECT is_admin, status FROM users WHERE id = $1", [b.userId]);
      if (!before) throw new HttpError(404, "Usuário não encontrado.");
      if (b.is_admin !== undefined) await query("UPDATE users SET is_admin = $2 WHERE id = $1", [b.userId, b.is_admin]);
      if (b.status) {
        await query("UPDATE users SET status = $2 WHERE id = $1 AND status <> 'deleted'", [b.userId, b.status]);
        if (b.status === "disabled") await query("DELETE FROM sessions WHERE user_id = $1", [b.userId]);
      }
      await audit(admin.id, "admin.user_update", "user", b.userId, { before, change: b });
      return json({ ok: true });
    }
    case "verification": {
      const b = await parseBody(req, z.object({ requestId: z.string().uuid(), decision: z.enum(["approved", "rejected"]), notes: z.string().trim().min(3).max(2000) }));
      const r = await one<{ supplier_id: string }>("UPDATE supplier_verification_requests SET status = $2, reviewed_by = $3, reviewed_at = now(), review_notes = $4 WHERE id = $1 AND status = 'pending' RETURNING supplier_id", [b.requestId, b.decision, admin.id, b.notes]);
      if (!r) throw new HttpError(404, "Solicitação não encontrada ou já analisada.");
      await query("UPDATE suppliers SET verification_status = $2, verification_notes = $3 WHERE id = $1 AND NOT is_demo", [r.supplier_id, b.decision === "approved" ? "verified" : "rejected", b.notes]);
      await audit(admin.id, "admin.supplier_verification", "supplier", r.supplier_id, { decision: b.decision, notes: b.notes });
      return json({ ok: true });
    }
    case "feedback": {
      const b = await parseBody(req, z.object({ id: z.coerce.number().int(), status: z.enum(["new", "reviewed", "closed"]) }));
      await query("UPDATE feedback SET status = $2 WHERE id = $1", [b.id, b.status]);
      return json({ ok: true });
    }
    default:
      throw new HttpError(404, "Ação inexistente.");
  }
});
