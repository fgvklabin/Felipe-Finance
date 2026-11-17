import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { query } from "@/lib/db";
import { defaultWatchlistId, listWatchItems, WATCH_TYPES } from "@/lib/watchlist";
import { findCompany, findFund, getCatalog } from "@/lib/market";

const Schema = z.object({ itemType: z.enum(WATCH_TYPES), itemRef: z.string().min(1).max(40) });

function exists(type: string, ref: string) {
  const cat = getCatalog();
  if (type === "commodity") return cat.instruments.some((i) => i.id === ref);
  if (type === "currency") return cat.currencies.some((c) => c.id === ref);
  if (type === "company") return !!findCompany(ref);
  if (type === "fund") return !!findFund(ref);
  return true;
}

export const GET = handler("watchlist/get", async () => {
  const u = await requireApiUser();
  return json({ items: await listWatchItems(u.id) });
});

export const POST = handler("watchlist/post", async (req) => {
  const u = await requireApiUser();
  const b = await parseBody(req, Schema);
  if (!exists(b.itemType, b.itemRef)) throw new HttpError(404, "Item não encontrado.");
  const wl = await defaultWatchlistId(u.id);
  await query("INSERT INTO watchlist_items (watchlist_id, item_type, item_ref) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [wl, b.itemType, b.itemRef]);
  return json({ ok: true }, 201);
});

export const DELETE = handler("watchlist/delete", async (req) => {
  const u = await requireApiUser();
  const b = await parseBody(req, Schema);
  await query("DELETE FROM watchlist_items i USING watchlists w WHERE w.id = i.watchlist_id AND w.user_id = $1 AND i.item_type = $2 AND i.item_ref = $3", [u.id, b.itemType, b.itemRef]);
  return json({ ok: true });
});
