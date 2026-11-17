import { z } from "zod";
import { HttpError, handler, json, limit, parseBody } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { audit, one } from "@/lib/db";

const Schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });
// Hash fictício para equalizar o tempo de resposta quando o e-mail não existe.
const DUMMY = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5yJ8rEGqZ1E0b2H8bQ8Yk3Zr1r1nV2K";

export const POST = handler("auth/login", async (req) => {
  await limit("login", 10, 15 * 60_000);
  const b = await parseBody(req, Schema);
  const u = await one<{ id: string; password_hash: string; status: string }>("SELECT id, password_hash, status FROM users WHERE email = $1", [b.email]);
  const ok = await verifyPassword(b.password, u?.password_hash ?? DUMMY);
  if (!u || !ok || u.status !== "active") throw new HttpError(401, "E-mail ou senha inválidos.");
  await createSession(u.id);
  await audit(u.id, "user.login", "user", u.id);
  return json({ ok: true });
});
