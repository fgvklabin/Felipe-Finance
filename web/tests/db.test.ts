// Testes de integração com banco real (PGlite em memória, mesmas migrações da produção).
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => { throw new Error(`redirect:${u}`); } }));

process.env.AVERMONT_PGLITE_DIR = "memory://";

const { query, one } = await import("../src/lib/db");
const { assertWorkspaceAccess, hashPassword, verifyPassword, validatePassword, AccessError } = await import("../src/lib/auth");

let userA: string, userB: string, wsA: string, wsB: string;

beforeAll(async () => {
  const mk = async (email: string) => (await one<{ id: string }>("INSERT INTO users (email, password_hash, name, account_type) VALUES ($1, 'x', 'T', 'business') RETURNING id", [email]))!.id;
  userA = await mk("a@t.com");
  userB = await mk("b@t.com");
  const ws = async (u: string, name: string, role = "owner") => {
    const o = await one<{ id: string }>("INSERT INTO organizations (name, kind) VALUES ($1, 'buyer') RETURNING id", [name]);
    const w = await one<{ id: string }>("INSERT INTO workspaces (organization_id, name) VALUES ($1, $2) RETURNING id", [o!.id, name]);
    await query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)", [w!.id, u, role]);
    return w!.id;
  };
  wsA = await ws(userA, "A");
  wsB = await ws(userB, "B");
}, 60_000);

describe("isolamento entre empresas", () => {
  it("membro acessa o próprio workspace", async () => {
    await expect(assertWorkspaceAccess(userA, wsA, "buyer")).resolves.toMatchObject({ workspace_id: wsA });
  });
  it("usuário de outra empresa é bloqueado", async () => {
    await expect(assertWorkspaceAccess(userB, wsA)).rejects.toBeInstanceOf(AccessError);
  });
  it("papel insuficiente é bloqueado", async () => {
    await query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'viewer')", [wsB, userA]);
    await expect(assertWorkspaceAccess(userA, wsB, "buyer")).rejects.toBeInstanceOf(AccessError);
    await expect(assertWorkspaceAccess(userA, wsB, "viewer")).resolves.toBeTruthy();
  });
});

describe("integridade do banco", () => {
  it("bloqueia alteração de preços históricos e de auditoria", async () => {
    await query("INSERT INTO data_sources (id, provider, category, api_available, auth_required, update_frequency, licensing_status, integration_status) VALUES ('t','t','t',true,false,'d','open','integrated')");
    await query("INSERT INTO commodity_categories VALUES ('c','c','c','#000000')");
    await query("INSERT INTO commodities (id, category_id, name_pt, name_en, kind, price_type, data_mode, unit, currency, frequency) VALUES ('k','c','k','k','raw','index','real','t','USD','monthly')");
    const p = await one<{ id: number }>("INSERT INTO historical_prices (commodity_id, source_id, observed_at, value, currency, unit) VALUES ('k','t','2025-01-01',10,'USD','t') RETURNING id");
    await expect(query("UPDATE historical_prices SET value = 11 WHERE id = $1", [p!.id])).rejects.toThrow(/append-only/);
    await expect(query("DELETE FROM historical_prices")).rejects.toThrow(/append-only/);
    // correção = nova linha que referencia a original
    await query("INSERT INTO historical_prices (commodity_id, source_id, observed_at, value, currency, unit, supersedes_id, correction_reason) VALUES ('k','t','2025-01-01',10.5,'USD','t',$1,'revisão da fonte')", [p!.id]);
    const cur = await one<{ value: number }>("SELECT value FROM current_prices WHERE commodity_id = 'k'");
    expect(cur!.value).toBe(10.5);
    await query("INSERT INTO audit_logs (action, entity_type) VALUES ('x','y')");
    await expect(query("DELETE FROM audit_logs")).rejects.toThrow(/append-only/);
  });
  it("fornecedor demonstrativo não pode ter contato nem ser verificado", async () => {
    await expect(query("INSERT INTO suppliers (name, is_demo, verification_status) VALUES ('x', true, 'verified')")).rejects.toThrow();
    const demo = await one<{ n: number }>("SELECT count(*)::int AS n FROM suppliers WHERE is_demo AND contact_email IS NULL");
    expect(demo!.n).toBeGreaterThanOrEqual(3);
  });
  it("valida cotações (preço e impostos)", async () => {
    await expect(query("INSERT INTO supplier_quotations (workspace_id, supplier_name, product, unit, quantity, unit_price, source) VALUES ($1,'s','p','t',1,-5,'manual')", [wsA])).rejects.toThrow();
    await expect(query("INSERT INTO supplier_quotations (workspace_id, supplier_name, product, unit, quantity, unit_price, tax_pct, source) VALUES ($1,'s','p','t',1,5,150,'manual')", [wsA])).rejects.toThrow();
  });
});

describe("senhas", () => {
  it("hash bcrypt e política mínima", async () => {
    const h = await hashPassword("senhaForte123");
    expect(await verifyPassword("senhaForte123", h)).toBe(true);
    expect(await verifyPassword("outra", h)).toBe(false);
    expect(validatePassword("curta1")).toMatch(/10 caracteres/);
    expect(validatePassword("somenteletrasaqui")).toMatch(/letras e números/);
    expect(validatePassword("boaSenha2026")).toBeNull();
  });
});
