import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { one, query } from "./db";

export const SESSION_COOKIE = "avm_session";
const SESSION_DAYS = 30;

export type AccountType = "investor" | "business" | "supplier";
export type WorkspaceRole = "owner" | "admin" | "buyer" | "viewer";

export interface User {
  id: string; email: string; name: string; account_type: AccountType; is_admin: boolean;
  locale: "pt" | "en"; notification_prefs: { inApp: boolean; email: boolean; whatsapp: boolean };
  onboarding: Record<string, unknown>; created_at: string;
}

export interface Membership { workspace_id: string; workspace_name: string; organization_id: string; organization_name: string; role: WorkspaceRole }

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "A senha precisa conter letras e números.";
  if (pw.length > 200) return "Senha longa demais.";
  return null;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const h = await headers();
  await query("INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)", [
    sha256(token), userId, String(SESSION_DAYS), (h.get("user-agent") ?? "").slice(0, 300),
  ]);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  c.delete(SESSION_COOKIE);
}

/** Usuário da requisição atual (memoizado por requisição). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await one<User>(
      `SELECT u.id, u.email, u.name, u.account_type, u.is_admin, u.locale, u.notification_prefs, u.onboarding, u.created_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
      [sha256(token)],
    );
  } catch (e) {
    console.error("[auth] falha ao ler sessão", e);
    return null;
  }
});

export async function requireUser(next = "/visao-geral"): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser("/admin");
  if (!u.is_admin) redirect("/visao-geral");
  return u;
}

export const getMemberships = cache(async (userId: string): Promise<Membership[]> =>
  query<Membership>(
    `SELECT m.workspace_id, w.name AS workspace_name, o.id AS organization_id, o.name AS organization_name, m.role
       FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id JOIN organizations o ON o.id = w.organization_id
      WHERE m.user_id = $1 ORDER BY m.created_at`,
    [userId],
  ),
);

const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 0, buyer: 1, admin: 2, owner: 3 };

/**
 * Garante que o usuário pertence ao workspace com pelo menos o papel exigido.
 * TODA consulta a dados confidenciais de compras passa por aqui (isolamento entre empresas).
 */
export async function assertWorkspaceAccess(userId: string, workspaceId: string, minRole: WorkspaceRole = "viewer"): Promise<Membership> {
  const m = (await getMemberships(userId)).find((x) => x.workspace_id === workspaceId);
  if (!m || ROLE_RANK[m.role] < ROLE_RANK[minRole]) throw new AccessError();
  return m;
}

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export class AccessError extends Error {
  status = 403;
  constructor(msg = "Acesso negado a este workspace.") {
    super(msg);
  }
}

export function isAdminEmail(email: string) {
  return (process.env.AVERMONT_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
