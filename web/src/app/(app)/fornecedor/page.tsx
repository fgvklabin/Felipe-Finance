import { redirect } from "next/navigation";
import { PageHeader, Notice } from "@/components/ui";
import { SupplierPortal } from "@/components/business/SupplierPortal";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getCatalog } from "@/lib/market";

export const metadata = { title: "Portal do Fornecedor" };

export default async function SupplierPortalPage() {
  const user = await requireUser("/fornecedor");
  if (user.account_type !== "supplier") redirect("/visao-geral");
  const s = await one<{ id: string; name: string; city: string | null; state: string | null; commodities: string[]; verification_status: string; contact_phone: string | null; website: string | null }>(
    "SELECT id, name, city, state, commodities, verification_status, contact_phone, website FROM suppliers WHERE owner_user_id = $1", [user.id]);
  if (!s) return <Notice tone="red">Perfil de fornecedor não encontrado.</Notice>;
  const rfqs = await query(
    `SELECT id, title, commodity_id, specification, quality_requirements, quantity, unit, delivery_location, delivery_deadline, payment_terms FROM purchase_requests
      WHERE visibility = 'marketplace' AND status = 'open' AND (commodity_id IS NULL OR commodity_id = ANY($1::text[])) ORDER BY created_at DESC LIMIT 100`, [s.commodities]);
  const commodities = getCatalog().instruments.map((i) => ({ id: i.id, label: i.name.pt }));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Portal do Fornecedor" accent="var(--cyan)" title={s.name} subtitle="Responda a pedidos de cotação publicados por compradores. Suas propostas chegam ao comprador como “não verificadas” até que ele confirme os valores." />
      <SupplierPortal supplier={s} rfqs={rfqs as never} commodities={commodities} />
    </div>
  );
}
