import { z } from "zod";
import { HttpError, handler, json, limit, parseBody } from "@/lib/api";
import { createSession, hashPassword, isAdminEmail, validatePassword } from "@/lib/auth";
import { audit, one, tx } from "@/lib/db";

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  accountType: z.enum(["investor", "business", "supplier"]),
  companyName: z.string().trim().max(200).optional(),
  cnpj: z.string().trim().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ no formato 00.000.000/0000-00").optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional(),
  state: z.string().trim().length(2).optional().or(z.literal("")),
  lgpdConsent: z.literal(true, { message: "É necessário aceitar a política de privacidade (LGPD)." }),
});

export const POST = handler("auth/register", async (req) => {
  await limit("register", 10, 60 * 60_000);
  const b = await parseBody(req, Schema);
  const pwErr = validatePassword(b.password);
  if (pwErr) throw new HttpError(422, pwErr);
  if (b.accountType !== "investor" && !b.companyName) throw new HttpError(422, "Informe o nome da empresa.");
  if (await one("SELECT 1 FROM users WHERE email = $1", [b.email])) throw new HttpError(409, "Já existe uma conta com este e-mail.");
  const hash = await hashPassword(b.password);
  // Em desenvolvimento, o primeiro usuário vira administrador para facilitar testes; em produção use AVERMONT_ADMIN_EMAILS.
  const noUsers = !(await one("SELECT 1 FROM users LIMIT 1"));
  const isAdmin = isAdminEmail(b.email) || (process.env.NODE_ENV !== "production" && noUsers);
  const userId = await tx(async (q) => {
    const u = (await q.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, name, account_type, is_admin, lgpd_consent_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id",
      [b.email, hash, b.name, b.accountType, isAdmin],
    )).rows[0];
    await q.query("INSERT INTO watchlists (user_id, name) VALUES ($1, 'Principal')", [u.id]);
    if (b.accountType !== "investor") {
      const org = (await q.query<{ id: string }>(
        "INSERT INTO organizations (name, cnpj, kind, industry, state) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [b.companyName, b.cnpj || null, b.accountType === "business" ? "buyer" : "supplier", b.industry || null, b.state ? b.state.toUpperCase() : null],
      )).rows[0];
      if (b.accountType === "business") {
        const ws = (await q.query<{ id: string }>("INSERT INTO workspaces (organization_id, name) VALUES ($1, $2) RETURNING id", [org.id, b.companyName])).rows[0];
        await q.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')", [ws.id, u.id]);
      } else {
        await q.query("INSERT INTO suppliers (organization_id, owner_user_id, name, cnpj, state, contact_email) VALUES ($1, $2, $3, $4, $5, $6)", [org.id, u.id, b.companyName, b.cnpj || null, b.state ? b.state.toUpperCase() : null, b.email]);
      }
    }
    const invites = (await q.query<{ id: string; workspace_id: string; role: string }>("SELECT id, workspace_id, role FROM workspace_invites WHERE email = $1 AND accepted_at IS NULL", [b.email])).rows;
    for (const inv of invites) {
      await q.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [inv.workspace_id, u.id, inv.role]);
      await q.query("UPDATE workspace_invites SET accepted_at = now() WHERE id = $1", [inv.id]);
    }
    return u.id;
  });
  await audit(userId, "user.register", "user", userId, { accountType: b.accountType, isAdmin });
  await createSession(userId);
  return json({ ok: true, next: "/onboarding" }, 201);
});
