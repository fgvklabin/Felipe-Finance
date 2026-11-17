import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { audit, one, query } from "@/lib/db";

type Ctx = { params: Promise<{ resource: string }> };

async function mySupplier() {
  const u = await requireApiUser();
  if (u.account_type !== "supplier") throw new HttpError(403, "Disponível apenas para contas de fornecedor.");
  const s = await one<{ id: string; name: string; commodities: string[]; verification_status: string }>("SELECT id, name, commodities, verification_status FROM suppliers WHERE owner_user_id = $1", [u.id]);
  if (!s) throw new HttpError(404, "Perfil de fornecedor não encontrado.");
  return { u, s };
}

export const GET = handler<Ctx>("supplier/get", async (_req, { params }) => {
  const { resource } = await params;
  const { s } = await mySupplier();
  if (resource !== "rfqs") throw new HttpError(404, "Recurso inexistente.");
  // Apenas pedidos públicos (marketplace) e abertos — sem expor dados internos do comprador.
  const rows = await query(
    `SELECT r.id, r.title, r.commodity_id, r.specification, r.quality_requirements, r.quantity, r.unit, r.delivery_location, r.delivery_deadline, r.payment_terms, r.created_at
       FROM purchase_requests r WHERE r.visibility = 'marketplace' AND r.status = 'open' AND (r.commodity_id IS NULL OR r.commodity_id = ANY($1::text[]))
      ORDER BY r.created_at DESC LIMIT 100`,
    [s.commodities],
  );
  return json({ items: rows });
});

const QuoteSchema = z.object({
  purchase_request_id: z.string().uuid(), unit_price: z.coerce.number().positive(), currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  freight_total: z.coerce.number().min(0).default(0), tax_pct: z.coerce.number().min(0).max(100).default(0), payment_days: z.coerce.number().int().min(0).max(720).default(0),
  delivery_days: z.coerce.number().int().min(0).max(720), min_order_qty: z.coerce.number().min(0).nullable().optional(), valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  specification: z.string().max(1000).nullable().optional(), contact: z.string().trim().min(3).max(300), notes: z.string().max(1000).nullable().optional(),
});

export const POST = handler<Ctx>("supplier/post", async (req, { params }) => {
  const { resource } = await params;
  const { u, s } = await mySupplier();
  if (resource === "quote") {
    const b = await parseBody(req, QuoteSchema);
    const r = await one<{ workspace_id: string; title: string; quantity: number; unit: string; commodity_id: string | null; delivery_location: string }>(
      "SELECT workspace_id, title, quantity, unit, commodity_id, delivery_location FROM purchase_requests WHERE id = $1 AND visibility = 'marketplace' AND status = 'open'", [b.purchase_request_id]);
    if (!r) throw new HttpError(404, "Pedido de cotação não está aberto.");
    const q = await one<{ id: string }>(
      `INSERT INTO supplier_quotations (workspace_id, purchase_request_id, supplier_id, supplier_name, commodity_id, product, specification, unit, quantity, unit_price, currency,
        freight_total, tax_pct, payment_days, delivery_days, delivery_location, min_order_qty, valid_until, contact, source, verified_by_user, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'supplier_portal',false,$20) RETURNING id`,
      [r.workspace_id, b.purchase_request_id, s.id, s.name, r.commodity_id, r.title, b.specification ?? null, r.unit, r.quantity, b.unit_price, b.currency,
        b.freight_total, b.tax_pct, b.payment_days, b.delivery_days, r.delivery_location, b.min_order_qty ?? null, b.valid_until, b.contact, b.notes ?? null],
    );
    await audit(u.id, "supplier.quote", "purchase_request", b.purchase_request_id, { supplierId: s.id });
    await query(
      `INSERT INTO notifications (user_id, title, body, link) SELECT m.user_id, 'Nova proposta recebida', $2, '/business/fornecedores'
         FROM workspace_members m WHERE m.workspace_id = $1 AND m.role IN ('owner','admin','buyer')`,
      [r.workspace_id, `${s.name} respondeu ao pedido “${r.title}”. Verifique os valores antes de usar.`],
    );
    return json({ id: q!.id }, 201);
  }
  if (resource === "verification") {
    const b = await parseBody(req, z.object({ evidence: z.string().trim().min(20).max(4000) }));
    await query("INSERT INTO supplier_verification_requests (supplier_id, requested_by, evidence) VALUES ($1, $2, $3)", [s.id, u.id, b.evidence]);
    await query("UPDATE suppliers SET verification_status = 'pending' WHERE id = $1 AND verification_status IN ('unverified','rejected')", [s.id]);
    await audit(u.id, "supplier.verification_request", "supplier", s.id);
    return json({ ok: true }, 201);
  }
  throw new HttpError(404, "Recurso inexistente.");
});

const ProfileSchema = z.object({
  city: z.string().max(120).nullable().optional(), state: z.string().length(2).nullable().optional().or(z.literal("").transform(() => null)),
  commodities: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(30), contact_phone: z.string().max(40).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
});

export const PATCH = handler<Ctx>("supplier/patch", async (req, { params }) => {
  const { resource } = await params;
  const { u, s } = await mySupplier();
  if (resource !== "profile") throw new HttpError(404, "Recurso inexistente.");
  const b = await parseBody(req, ProfileSchema);
  await query("UPDATE suppliers SET city = $2, state = $3, commodities = $4, contact_phone = $5, website = $6 WHERE id = $1", [s.id, b.city ?? null, b.state?.toUpperCase() ?? null, b.commodities, b.contact_phone ?? null, b.website ?? null]);
  await audit(u.id, "supplier.profile_update", "supplier", s.id);
  return json({ ok: true });
});
