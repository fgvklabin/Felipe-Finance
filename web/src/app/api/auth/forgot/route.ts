import crypto from "node:crypto";
import { z } from "zod";
import { handler, json, limit, parseBody } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";

const Schema = z.object({ email: z.string().trim().toLowerCase().email() });

export const POST = handler("auth/forgot", async (req) => {
  await limit("forgot", 5, 60 * 60_000);
  const { email } = await parseBody(req, Schema);
  const u = await one<{ id: string; name: string }>("SELECT id, name FROM users WHERE email = $1 AND status = 'active'", [email]);
  let devLink: string | undefined;
  if (u) {
    const token = crypto.randomBytes(32).toString("base64url");
    await query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [sha256(token), u.id]);
    const link = appUrl(`/redefinir-senha?token=${token}`);
    const status = await sendEmail(email, "Avermont — redefinição de senha", `Olá, ${u.name}.\n\nPara criar uma nova senha, acesse (válido por 1 hora):\n${link}\n\nSe você não solicitou, ignore este e-mail.`);
    if (status !== "sent" && process.env.NODE_ENV !== "production") devLink = link;
  }
  // Resposta idêntica exista ou não a conta (evita enumeração de e-mails)
  return json({ ok: true, message: "Se houver uma conta com este e-mail, enviaremos instruções.", devLink });
});
