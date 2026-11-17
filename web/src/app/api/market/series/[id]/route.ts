import { getSeries } from "@/lib/market";
import { HttpError, handler, json, limit } from "@/lib/api";

function monthlyAverage(points: [string, number][]): [string, number][] {
  const acc = new Map<string, { s: number; n: number }>();
  for (const [d, v] of points) {
    const k = `${d.slice(0, 7)}-01`;
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += v;
    a.n += 1;
    acc.set(k, a);
  }
  return [...acc.entries()].sort().map(([k, a]) => [k, +(a.s / a.n).toFixed(6)]);
}

export const GET = handler<{ params: Promise<{ id: string }> }>("market/series", async (req, { params }) => {
  await limit("series", 240, 60_000);
  const { id } = await params;
  const s = getSeries(id);
  if (!s) throw new HttpError(404, "Série não encontrada.");
  const monthly = new URL(req.url).searchParams.get("monthly") === "1";
  const points = monthly && s.frequency === "daily" ? monthlyAverage(s.points) : s.points;
  return json({ id: s.id, frequency: monthly ? "monthly" : s.frequency, provider: s.provider, demo: !!s.demo, points });
});
