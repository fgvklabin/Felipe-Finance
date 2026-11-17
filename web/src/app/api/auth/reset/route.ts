import { z } from "zod";
import { HttpError, handler, json, limit, parseBody } from "@/lib/api";
import { hashPassword, sha256, validatePassword } from "@/lib/auth";
import { audit, tx } from "@/lib/db";

const Schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(1).max(200) });

export const POST = handler("auth/reset", async (req) => {
  await limit("reset", 10, 60 * 60_000);
  const b = await parseBody(req, Schema);
  const err = validatePassword(b.password);
  if (err) throw new HttpError(422, err);
  const hash = await hashPassword(b.password);
  const userId = await tx(async (q) => {
    const r = (await q.query<{ user_id: string }>(
      "UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id",
      [sha256(b.token)],
    )).rows[0];
    if (!r) throw new HttpError(400, "Link inválido ou expirado. Solicite uma nova redefinição.");
    await q.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, r.user_id]);
    await q.query("DELETE FROM sessions WHERE user_id = $1", [r.user_id]); // encerra sessões antigas
    return r.user_id;
  });
  await audit(userId, "user.password_reset", "user", userId);
  return json({ ok: true });
});
