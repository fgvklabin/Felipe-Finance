import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Acesso a dados: PostgreSQL (DATABASE_URL — Supabase/produção) ou PGlite (Postgres embutido,
 * desenvolvimento local sem credenciais). As MESMAS migrações SQL rodam nos dois.
 */

export type Row = Record<string, unknown>;
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface TxQueryable extends Queryable {
  exec(sql: string): Promise<void>;
}
interface Db extends Queryable {
  kind: "postgres" | "pglite";
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (q: TxQueryable) => Promise<T>): Promise<T>;
}

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function createPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: process.env.DATABASE_SSL === "disable" ? false : url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  return {
    kind: "postgres",
    query: async (sql, params) => {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          query: async (sql, params) => ({ rows: (await client.query(sql, params as unknown[])).rows }),
          exec: async (sql) => {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.AVERMONT_PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const memory = dir === "memory://";
  if (!memory) fs.mkdirSync(dir, { recursive: true });
  const pg = memory ? new PGlite() : new PGlite(dir);
  await pg.waitReady;
  return {
    kind: "pglite",
    query: async (sql, params) => {
      const r = await pg.query(sql, params as unknown[]);
      return { rows: r.rows as never[] };
    },
    exec: async (sql) => {
      await pg.exec(sql);
    },
    transaction: (fn) =>
      pg.transaction(async (tx) =>
        fn({
          query: async (sql, params) => ({ rows: (await tx.query(sql, params as unknown[])).rows as never[] }),
          exec: async (sql) => {
            await tx.exec(sql);
          },
        }),
      ),
  };
}

async function migrate(db: Db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Map((await db.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations")).rows.map((r) => [r.name, r.checksum]));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf-8");
    const sum = crypto.createHash("sha256").update(sql).digest("hex");
    const prev = applied.get(f);
    if (prev) {
      if (prev !== sum) console.warn(`[db] migração ${f} foi alterada após aplicada (checksum diferente). Crie uma nova migração em vez de editar.`);
      continue;
    }
    await db.transaction(async (q) => {
      await q.exec(sql);
      await q.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [f, sum]);
    });
    console.info(`[db] migração aplicada: ${f}`);
  }
}

const g = globalThis as unknown as { __avermontDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__avermontDb) {
    g.__avermontDb = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url && process.env.NODE_ENV === "production" && process.env.AVERMONT_ALLOW_PGLITE !== "1") {
        throw new Error("DATABASE_URL não configurada. Em produção use PostgreSQL/Supabase (ou defina AVERMONT_ALLOW_PGLITE=1 para demonstração local).");
      }
      const db = url ? await createPostgres(url) : await createPglite();
      await migrate(db);
      return db;
    })().catch((e) => {
      g.__avermontDb = undefined;
      throw e;
    });
  }
  return g.__avermontDb;
}

/** Converte Date em string ISO (datas puras → AAAA-MM-DD) para serialização segura até o cliente. */
function normalize<T>(rows: T[]): T[] {
  for (const r of rows as Record<string, unknown>[]) {
    for (const k in r) {
      const v = r[k];
      if (v instanceof Date) {
        const iso = v.toISOString();
        r[k] = iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
      }
    }
  }
  return rows;
}

export async function query<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  const db = await getDb();
  return normalize((await db.query<T>(sql, params)).rows);
}

export async function one<T = Row>(sql: string, params?: unknown[]): Promise<T | null> {
  return (await query<T>(sql, params))[0] ?? null;
}

export async function tx<T>(fn: (q: TxQueryable) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

export async function audit(actor: string | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  await query("INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)", [actor, action, entityType, entityId, JSON.stringify(details)]);
}

export async function logError(route: string, err: unknown, userId?: string | null) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    await query("INSERT INTO error_logs (route, message, stack, user_id) VALUES ($1, $2, $3, $4)", [route, e.message.slice(0, 2000), e.stack?.slice(0, 8000) ?? null, userId ?? null]);
  } catch {
    console.error("[error_logs] falha ao registrar erro", err);
  }
}
