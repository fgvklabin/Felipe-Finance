import { z } from "zod";
import { handler, json, parseBody, requireApiUser } from "@/lib/api";
import { getMemberships } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { defaultWatchlistId } from "@/lib/watchlist";
import { getCatalog } from "@/lib/market";

const Schema = z.object({
  watch: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(30).default([]),
  materials: z.array(z.object({ commodityId: z.string().regex(/^[a-z0-9-]+$/), consumption: z.number().nonnegative().max(1e9), price: z.number().nonnegative().max(1e9), unit: z.string().max(20) })).max(20).default([]),
  supplies: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(30).default([]),
});

export const POST = handler("onboarding", async (req) => {
  const u = await requireApiUser();
  const b = await parseBody(req, Schema);
  const cat = getCatalog();
  const valid = new Set([...cat.instruments.map((i) => i.id), ...cat.currencies.map((c) => c.id)]);
  const wl = await defaultWatchlistId(u.id);
  for (const id of b.watch.filter((x) => valid.has(x))) {
    const type = cat.currencies.some((c) => c.id === id) ? "currency" : "commodity";
    await query("INSERT INTO watchlist_items (watchlist_id, item_type, item_ref) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [wl, type, id]);
  }
  if (u.account_type === "business" && b.materials.length) {
    const ws = (await getMemberships(u.id))[0];
    if (ws) {
      await tx(async (q) => {
        for (const m of b.materials.filter((x) => valid.has(x.commodityId))) {
          const name = cat.instruments.find((i) => i.id === m.commodityId)?.name.pt ?? m.commodityId;
          await q.query(
            "INSERT INTO workspace_materials (workspace_id, commodity_id, name, unit, monthly_consumption, current_price) VALUES ($1, $2, $3, $4, $5, $6)",
            [ws.workspace_id, m.commodityId, name, m.unit || "t", m.consumption, m.price],
          );
        }
      });
    }
  }
  if (u.account_type === "supplier" && b.supplies.length) {
    await query("UPDATE suppliers SET commodities = $1 WHERE owner_user_id = $2", [b.supplies.filter((x) => valid.has(x)), u.id]);
  }
  await query("UPDATE users SET onboarding = onboarding || $1::jsonb WHERE id = $2", [JSON.stringify({ completedAt: new Date().toISOString() }), u.id]);
  return json({ ok: true, next: u.account_type === "business" ? "/business" : u.account_type === "supplier" ? "/fornecedor" : "/carteira" });
});
