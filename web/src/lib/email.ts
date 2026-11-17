import "server-only";
import { query } from "./db";

/**
 * Envio de e-mail transacional. Usa Resend (RESEND_API_KEY + EMAIL_FROM) quando configurado;
 * caso contrário registra a mensagem na caixa de saída com status "not_configured" (visível no admin).
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<"sent" | "failed" | "not_configured"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    await query("INSERT INTO email_outbox (to_email, subject, body, status) VALUES ($1, $2, $3, 'not_configured')", [to, subject, body]);
    return "not_configured";
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    await query("INSERT INTO email_outbox (to_email, subject, body, status, sent_at) VALUES ($1, $2, $3, 'sent', now())", [to, subject, body]);
    return "sent";
  } catch (e) {
    await query("INSERT INTO email_outbox (to_email, subject, body, status, error) VALUES ($1, $2, $3, 'failed', $4)", [to, subject, body, (e as Error).message]);
    return "failed";
  }
}

export function appUrl(path = "/") {
  return new URL(path, process.env.APP_URL ?? "http://localhost:3000").toString();
}
