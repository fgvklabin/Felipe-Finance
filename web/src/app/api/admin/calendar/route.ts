import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { audit, one } from "@/lib/db";

const Schema = z.object({
  title: z.string().trim().min(3).max(200),
  startsAt: z.string().min(10),
  category: z.enum(["macro", "commodities", "moedas", "empresas"]),
  sourceName: z.string().trim().min(2).max(200),
  sourceUrl: z.string().url().refine((u) => u.startsWith("https://"), "Use um link https da fonte oficial"),
  confirmed: z.string().optional(),
});

export const POST = handler("admin/calendar", async (req) => {
  const u = await requireApiUser();
  if (!u.is_admin) throw new HttpError(403, "Apenas administradores.");
  const b = await parseBody(req, Schema);
  const row = await one<{ id: string }>(
    "INSERT INTO calendar_events (title, starts_at, category, source_name, source_url, confirmed, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [b.title, new Date(b.startsAt).toISOString(), b.category, b.sourceName, b.sourceUrl, b.confirmed === "1", u.id],
  );
  await audit(u.id, "calendar.create", "calendar_event", row!.id, { title: b.title });
  return json({ id: row!.id }, 201);
});
