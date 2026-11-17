import "server-only";
import { one, query } from "./db";

export const WATCH_TYPES = ["commodity", "currency", "company", "fund", "supplier", "indicator"] as const;
export type WatchType = (typeof WATCH_TYPES)[number];

export async function defaultWatchlistId(userId: string): Promise<string> {
  const row = await one<{ id: string }>(
    `INSERT INTO watchlists (user_id, name) VALUES ($1, 'Principal')
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [userId],
  );
  return row!.id;
}

export async function listWatchItems(userId: string) {
  return query<{ item_type: WatchType; item_ref: string; created_at: string; watchlist: string }>(
    `SELECT i.item_type, i.item_ref, i.created_at, w.name AS watchlist FROM watchlist_items i JOIN watchlists w ON w.id = i.watchlist_id
      WHERE w.user_id = $1 ORDER BY i.created_at DESC`,
    [userId],
  );
}

export async function isWatched(userId: string | undefined, type: WatchType, ref: string): Promise<boolean> {
  if (!userId) return false;
  const r = await one(`SELECT 1 FROM watchlist_items i JOIN watchlists w ON w.id = i.watchlist_id WHERE w.user_id = $1 AND i.item_type = $2 AND i.item_ref = $3`, [userId, type, ref]).catch(() => null);
  return !!r;
}
