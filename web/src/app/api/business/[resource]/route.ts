import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { assertWorkspaceAccess, getMemberships } from "@/lib/auth";
import { audit, one, query, tx } from "@/lib/db";
import { currentWorkspace } from "@/lib/business";

/*
 * API do Avermont Business — recursos do workspace ativo:
 *   materials | quotes | purchases | rfq | suppliers | members | workspace
 * Toda leitura/escrita é filtrada por workspace_id após assertWorkspaceAccess (isolamento entre empresas).
 */

const slug = z.string().regex(/^[a-z0-9-]+$/).max(60);
const num = (max = 1e12) => z.coerce.number().finite().min(0).max(max);

const MaterialSchema = z.object({
  name: z.string().trim().min(1).max(120), commodity_id: slug.nullable().optional(), unit: z.string().trim().min(1).max(20),
  monthly_consumption: num(), current_price: num(), currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"), inventory_qty: num().default(0),
  lead_time_days: z.coerce.number().int().min(0).max(720).default(15), storage_cost_pct_month: num(100).default(0.5),
  usd_share: num(100).default(0), essential: z.boolean().default(true),
});

export const QuoteSchema = z.object({
  supplier_name: z.string().trim().min(1).max(200), supplier_id: z.string().uuid().nullable().optional(), commodity_id: slug.nullable().optional(),
  product: z.string().trim().min(1).max(200), specification: z.string().max(1000).nullable().optional(), quality: z.string().max(300).nullable().optional(),
  unit: z.string().trim().min(1).max(20), quantity: z.coerce.number().positive().max(1e12), unit_price: z.coerce.number().positive().max(1e12),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"), freight_total: num().default(0), tax_pct: num(100).default(0),
  payment_days: z.coerce.number().int().min(0).max(720).default(0), delivery_days: z.coerce.number().int().min(0).max(720).nullable().optional(),
  delivery_location: z.string().max(200).nullable().optional(), min_order_qty: num().nullable().optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null)), contact: z.string().max(300).nullable().optional(),
  source: z.enum(["manual", "csv", "xlsx", "pdf_ai", "image_ai"]).default("manual"),
  verified: z.boolean(), extraction: z.record(z.string(), z.unknown()).nullable().optional(), notes: z.string().max(2000).nullable().optional(),
  purchase_request_id: z.string().uuid().nullable().optional(),
});

const PurchaseSchema = z.object({
  material_id: z.string().uuid().nullable().optional(), purchased_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().positive(), currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"), supplier_name: z.string().max(200).nullable().optional(), notes: z.string().max(1000).nullable().optional(),
});

const RfqSchema = z.object({
  title: z.string().trim().min(3).max(200), commodity_id: slug.nullable().optional(), specification: z.string().max(2000).nullable().optional(),
  quality_requirements: z.string().max(1000).nullable().optional(), quantity: z.coerce.number().positive(), unit: z.string().trim().min(1).max(20),
  delivery_location: z.string().trim().min(2).max(200), delivery_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null)),
  payment_terms: z.string().max(200).nullable().optional(), budget_max: z.coerce.number().positive().nullable().optional(), visibility: z.enum(["private", "marketplace"]).default("private"),
});

const SupplierSchema = z.object({
  name: z.string().trim().min(2).max(200), cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null)),
  city: z.string().max(120).nullable().optional(), state: z.string().length(2).nullable().optional().or(z.literal("").transform(() => null)),
  commodities: z.array(slug).max(30).default([]), contact_email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  contact_phone: z.string().max(40).nullable().optional(), website: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
});

const InviteSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["admin", "buyer", "viewer"]) });

type Ctx = { params: Promise<{ resource: string }> };

async function ws(minRole: "viewer" | "buyer" | "admin" | "owner" = "viewer") {
  const u = await requireApiUser();
  const m = await currentWorkspace(u);
  if (!m) throw new HttpError(404, "Você ainda não tem um workspace empresarial.");
  await assertWorkspaceAccess(u.id, m.workspace_id, minRole);
  return { u, wsId: m.workspace_id, role: m.role };
}

export const GET = handler<Ctx>("business/get", async (_req, { params }) => {
  const { resource } = await params;
  const { wsId } = await ws("viewer");
  switch (resource) {
    case "materials":
      return json({ items: await query("SELECT * FROM workspace_materials WHERE workspace_id = $1 ORDER BY created_at", [wsId]) });
    case "quotes":
      return json({
        items: await query(
          `SELECT q.*, s.verification_status AS supplier_verification FROM supplier_quotations q LEFT JOIN suppliers s ON s.id = q.supplier_id
            WHERE q.workspace_id = $1 ORDER BY q.created_at DESC`, [wsId]),
      });
    case "purchases":
      return json({ items: await query("SELECT * FROM procurement_history WHERE workspace_id = $1 ORDER BY purchased_at DESC", [wsId]) });
    case "rfq":
      return json({ items: await query("SELECT r.*, (SELECT count(*)::int FROM supplier_quotations q WHERE q.purchase_request_id = r.id) AS responses FROM purchase_requests r WHERE workspace_id = $1 ORDER BY created_at DESC", [wsId]) });
    case "suppliers":
      return json({ items: await query("SELECT * FROM suppliers WHERE private_to_workspace IS NULL OR private_to_workspace = $1 ORDER BY is_demo, name", [wsId]) });
    case "members":
      return json({
        members: await query("SELECT u.id, u.name, u.email, m.role, m.created_at FROM workspace_members m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 ORDER BY m.created_at", [wsId]),
        invites: await query("SELECT id, email, role, created_at, accepted_at FROM workspace_invites WHERE workspace_id = $1 ORDER BY created_at DESC", [wsId]),
      });
    default:
      throw new HttpError(404, "Recurso inexistente.");
  }
});

export const POST = handler<Ctx>("business/post", async (req, { params }) => {
  const { resource } = await params;
  if (resource === "workspace") {
    const u = await requireApiUser();
    if ((await getMemberships(u.id)).length) throw new HttpError(409, "Você já participa de um workspace.");
    const b = await parseBody(req, z.object({ companyName: z.string().trim().min(2).max(200), industry: z.string().max(120).optional() }));
    const id = await tx(async (q) => {
      const org = (await q.query<{ id: string }>("INSERT INTO organizations (name, kind, industry) VALUES ($1, 'buyer', $2) RETURNING id", [b.companyName, b.industry ?? null])).rows[0];
      const w = (await q.query<{ id: string }>("INSERT INTO workspaces (organization_id, name) VALUES ($1, $2) RETURNING id", [org.id, b.companyName])).rows[0];
      await q.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')", [w.id, u.id]);
      return w.id;
    });
    await audit(u.id, "workspace.create", "workspace", id);
    return json({ id }, 201);
  }
  if (resource === "members") {
    const { u, wsId } = await ws("admin");
    const b = await parseBody(req, InviteSchema);
    const existing = await one<{ id: string }>("SELECT id FROM users WHERE email = $1 AND status = 'active'", [b.email]);
    if (existing) {
      await query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role", [wsId, existing.id, b.role]);
    } else {
      await query("INSERT INTO workspace_invites (workspace_id, email, role, invited_by) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id, email) DO UPDATE SET role = EXCLUDED.role", [wsId, b.email, b.role, u.id]);
    }
    await audit(u.id, "workspace.invite", "workspace", wsId, { email: b.email, role: b.role, existingUser: !!existing });
    return json({ ok: true, added: !!existing }, 201);
  }
  const { u, wsId } = await ws("buyer");
  switch (resource) {
    case "materials": {
      const b = await parseBody(req, MaterialSchema);
      const r = await one("INSERT INTO workspace_materials (workspace_id, commodity_id, name, unit, monthly_consumption, current_price, currency, inventory_qty, lead_time_days, storage_cost_pct_month, usd_share, essential) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
        [wsId, b.commodity_id ?? null, b.name, b.unit, b.monthly_consumption, b.current_price, b.currency, b.inventory_qty, b.lead_time_days, b.storage_cost_pct_month, b.usd_share, b.essential]);
      return json({ item: r }, 201);
    }
    case "quotes": {
      const body = await req.json().catch(() => null);
      const list = z.array(QuoteSchema).min(1).max(200).parse(Array.isArray(body) ? body : [body]);
      if (list.some((x) => !x.verified)) throw new HttpError(422, "Confirme que verificou os valores de cada cotação antes de salvar.");
      const ids = await tx(async (q) => {
        const out: string[] = [];
        for (const b of list) {
          if (b.supplier_id) {
            const s = (await q.query("SELECT 1 FROM suppliers WHERE id = $1 AND (private_to_workspace IS NULL OR private_to_workspace = $2) AND NOT is_demo", [b.supplier_id, wsId])).rows[0];
            if (!s) throw new HttpError(422, "Fornecedor inválido para este workspace.");
          }
          if (b.purchase_request_id) {
            const r = (await q.query("SELECT 1 FROM purchase_requests WHERE id = $1 AND workspace_id = $2", [b.purchase_request_id, wsId])).rows[0];
            if (!r) throw new HttpError(422, "Pedido de cotação inválido.");
          }
          const r = (await q.query<{ id: string }>(
            `INSERT INTO supplier_quotations (workspace_id, purchase_request_id, supplier_id, supplier_name, commodity_id, product, specification, quality, unit, quantity, unit_price, currency,
              freight_total, tax_pct, payment_days, delivery_days, delivery_location, min_order_qty, valid_until, contact, source, verified_by_user, verified_at, verified_by, extraction, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,true,now(),$22,$23,$24,$22) RETURNING id`,
            [wsId, b.purchase_request_id ?? null, b.supplier_id ?? null, b.supplier_name, b.commodity_id ?? null, b.product, b.specification ?? null, b.quality ?? null, b.unit, b.quantity, b.unit_price, b.currency,
              b.freight_total, b.tax_pct, b.payment_days, b.delivery_days ?? null, b.delivery_location ?? null, b.min_order_qty ?? null, b.valid_until ?? null, b.contact ?? null, b.source, u.id,
              b.extraction ? JSON.stringify(b.extraction) : null, b.notes ?? null],
          )).rows[0];
          out.push(r.id);
        }
        return out;
      });
      await audit(u.id, "quotes.create", "workspace", wsId, { count: ids.length, sources: [...new Set(list.map((x) => x.source))] });
      // Alertas de "nova cotação" para membros do workspace
      await query(
        `INSERT INTO notifications (user_id, alert_id, title, body, link)
         SELECT a.user_id, a.id, 'Nova cotação registrada', $2, '/business/fornecedores' FROM alerts a
          WHERE a.alert_type = 'new_quote' AND a.active AND a.workspace_id = $1`,
        [wsId, `${ids.length} cotação(ões) adicionada(s): ${list.map((x) => x.supplier_name).slice(0, 3).join(", ")}`],
      );
      return json({ ids }, 201);
    }
    case "purchases": {
      const b = await parseBody(req, PurchaseSchema);
      if (b.material_id && !(await one("SELECT 1 FROM workspace_materials WHERE id = $1 AND workspace_id = $2", [b.material_id, wsId]))) throw new HttpError(422, "Material inválido.");
      const r = await one("INSERT INTO procurement_history (workspace_id, material_id, purchased_at, quantity, unit_price, currency, supplier_name, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [wsId, b.material_id ?? null, b.purchased_at, b.quantity, b.unit_price, b.currency, b.supplier_name ?? null, b.notes ?? null, u.id]);
      return json({ item: r }, 201);
    }
    case "rfq": {
      const b = await parseBody(req, RfqSchema);
      const r = await one("INSERT INTO purchase_requests (workspace_id, commodity_id, title, specification, quality_requirements, quantity, unit, delivery_location, delivery_deadline, payment_terms, budget_max, visibility, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
        [wsId, b.commodity_id ?? null, b.title, b.specification ?? null, b.quality_requirements ?? null, b.quantity, b.unit, b.delivery_location, b.delivery_deadline ?? null, b.payment_terms ?? null, b.budget_max ?? null, b.visibility, u.id]);
      await audit(u.id, "rfq.create", "workspace", wsId, { visibility: b.visibility });
      return json({ item: r }, 201);
    }
    case "suppliers": {
      const b = await parseBody(req, SupplierSchema);
      const r = await one("INSERT INTO suppliers (private_to_workspace, name, cnpj, city, state, commodities, contact_email, contact_phone, website) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [wsId, b.name, b.cnpj ?? null, b.city ?? null, b.state?.toUpperCase() ?? null, b.commodities, b.contact_email ?? null, b.contact_phone ?? null, b.website ?? null]);
      return json({ item: r }, 201);
    }
    default:
      throw new HttpError(404, "Recurso inexistente.");
  }
});

const DeleteSchema = z.object({ id: z.string().uuid() });
const TABLES: Record<string, string> = { materials: "workspace_materials", quotes: "supplier_quotations", purchases: "procurement_history", suppliers: "suppliers" };

export const DELETE = handler<Ctx>("business/delete", async (req, { params }) => {
  const { resource } = await params;
  if (resource === "members") {
    const { u, wsId } = await ws("admin");
    const { id } = await parseBody(req, DeleteSchema);
    if (id === u.id) throw new HttpError(422, "Você não pode remover a si mesmo.");
    const target = await one<{ role: string }>("SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", [wsId, id]);
    if (target?.role === "owner") throw new HttpError(422, "O proprietário não pode ser removido.");
    await query("DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", [wsId, id]);
    await audit(u.id, "workspace.remove_member", "workspace", wsId, { userId: id });
    return json({ ok: true });
  }
  const { u, wsId } = await ws("buyer");
  const table = TABLES[resource];
  if (!table) throw new HttpError(404, "Recurso inexistente.");
  const { id } = await parseBody(req, DeleteSchema);
  const col = resource === "suppliers" ? "private_to_workspace" : "workspace_id";
  const r = await query(`DELETE FROM ${table} WHERE id = $1 AND ${col} = $2 RETURNING id`, [id, wsId]);
  if (!r.length) throw new HttpError(404, "Registro não encontrado neste workspace.");
  await audit(u.id, `${resource}.delete`, "workspace", wsId, { id });
  return json({ ok: true });
});

export const PATCH = handler<Ctx>("business/patch", async (req, { params }) => {
  const { resource } = await params;
  const { wsId } = await ws("buyer");
  if (resource === "materials") {
    const b = await parseBody(req, MaterialSchema.partial().extend({ id: z.string().uuid() }));
    const { id, ...rest } = b;
    const keys = Object.keys(rest) as (keyof typeof rest)[];
    if (!keys.length) throw new HttpError(422, "Nada para atualizar.");
    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const r = await one(`UPDATE workspace_materials SET ${sets}, updated_at = now() WHERE id = $1 AND workspace_id = $2 RETURNING *`, [id, wsId, ...keys.map((k) => rest[k] ?? null)]);
    if (!r) throw new HttpError(404, "Material não encontrado.");
    return json({ item: r });
  }
  if (resource === "quotes") {
    const b = await parseBody(req, z.object({ id: z.string().uuid(), verified: z.literal(true) }));
    const u = await requireApiUser();
    const r = await one("UPDATE supplier_quotations SET verified_by_user = true, verified_at = now(), verified_by = $3 WHERE id = $1 AND workspace_id = $2 AND NOT is_demo RETURNING id", [b.id, wsId, u.id]);
    if (!r) throw new HttpError(404, "Cotação não encontrada.");
    await audit(u.id, "quotes.verify", "workspace", wsId, { id: b.id });
    return json({ ok: true });
  }
  if (resource === "rfq") {
    const b = await parseBody(req, z.object({ id: z.string().uuid(), status: z.enum(["open", "closed", "cancelled"]) }));
    const r = await one("UPDATE purchase_requests SET status = $3 WHERE id = $1 AND workspace_id = $2 RETURNING id", [b.id, wsId, b.status]);
    if (!r) throw new HttpError(404, "Pedido não encontrado.");
    return json({ ok: true });
  }
  throw new HttpError(404, "Recurso inexistente.");
});
