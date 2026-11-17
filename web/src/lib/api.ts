import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ZodError, type ZodType } from "zod";
import { AccessError, getCurrentUser, type User } from "./auth";
import { logError } from "./db";
import { rateLimit } from "./ratelimit";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido (JSON esperado).");
  }
  return schema.parse(body);
}

export async function requireApiUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Faça login para continuar.");
  return u;
}

export async function limit(key: string, max: number, windowMs: number) {
  const ip = await clientIp();
  if (!rateLimit(`${key}:${ip}`, max, windowMs)) throw new HttpError(429, "Muitas requisições. Tente novamente em instantes.");
}

/** Envolve um handler: converte erros em respostas JSON consistentes e registra falhas inesperadas. */
export function handler<C>(route: string, fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof AccessError) return json({ error: e.message }, 403);
      if (e instanceof ZodError) return json({ error: "Dados inválidos.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 422);
      const u = await getCurrentUser().catch(() => null);
      await logError(route, e, u?.id);
      console.error(`[api ${route}]`, e);
      return json({ error: "Erro interno. O incidente foi registrado." }, 500);
    }
  };
}
