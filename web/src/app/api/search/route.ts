import { getCatalog, getCompanies, getFunds, getMacro } from "@/lib/market";
import { getCurrentUser, getMemberships } from "@/lib/auth";
import { query } from "@/lib/db";
import { handler, json, limit } from "@/lib/api";
import { NAV } from "@/lib/nav";
import { t } from "@/lib/i18n";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const GET = handler("search", async (req) => {
  await limit("search", 120, 60_000);
  const q = norm(new URL(req.url).searchParams.get("q")?.slice(0, 80) ?? "");
  const cat = getCatalog();
  const results: { type: string; id: string; label: string; sub?: string; href: string; demo?: boolean; score: number }[] = [];
  const score = (label: string, extra = "") => {
    if (!q) return 1;
    const l = norm(label);
    if (l.startsWith(q)) return 3;
    if (l.includes(q)) return 2;
    return norm(extra).includes(q) ? 1 : 0;
  };
  for (const i of cat.instruments) {
    const s = score(`${i.name.pt} ${i.name.en}`, `${i.id} ${i.category}`);
    if (s) results.push({ type: "commodity", id: i.id, label: i.name.pt, sub: cat.categories.find((c) => c.id === i.category)?.name.pt, href: `/commodity/${i.id}`, demo: i.dataMode === "demo", score: s + 0.5 });
  }
  for (const c of cat.currencies) {
    const s = score(`${c.name.pt} ${c.pair}`, c.id);
    if (s) results.push({ type: "currency", id: c.id, label: `${c.pair} — ${c.name.pt}`, sub: c.dataMode === "unavailable" ? "indisponível" : undefined, href: `/moedas/${c.id}`, score: s + 0.4 });
  }
  for (const co of getCompanies().companies) {
    const s = score(`${co.tickersGiven.join(" ")} ${co.name ?? ""}`, co.sector ?? "");
    if (s) results.push({ type: "company", id: co.cnpj, label: `${co.tickersGiven.join("/")} — ${co.name}`, sub: co.sector ?? undefined, href: `/empresas/${co.tickersGiven[0]}`, score: s + 0.3 });
  }
  if (q.length >= 2) {
    for (const f of getFunds().funds) {
      const s = score(f.name, `${f.tags.join(" ")} ${f.manager ?? ""} ${f.cnpj}`);
      if (s) results.push({ type: f.vehicle === "etf" ? "etf" : "fund", id: f.cnpjDigits, label: f.name, sub: f.cnpj, href: `/fundos/${f.cnpjDigits}`, score: s });
    }
  }
  for (const ind of Object.values(getMacro().indicators)) {
    const s = score(ind.name, ind.id);
    if (s) results.push({ type: "indicator", id: ind.id, label: ind.name, sub: ind.source, href: "/moedas#indicadores", score: s });
  }
  for (const g of NAV) for (const it of g.items) {
    const s = score(t(it.key, "pt"), t(it.key, "en"));
    if (s && q) results.push({ type: "page", id: it.href, label: t(it.key, "pt"), href: it.href, score: s - 0.5 });
  }
  // Fornecedores: demonstrativos/públicos + privados do(s) workspace(s) do usuário
  if (q.length >= 2) {
    const u = await getCurrentUser();
    const ws = u ? (await getMemberships(u.id)).map((m) => m.workspace_id) : [];
    const sup = await query<{ id: string; name: string; is_demo: boolean; city: string | null }>(
      `SELECT id, name, is_demo, city FROM suppliers WHERE (private_to_workspace IS NULL OR private_to_workspace = ANY($1::uuid[])) AND lower(name) LIKE $2 LIMIT 8`,
      [ws, `%${q}%`],
    ).catch(() => []);
    for (const s of sup) results.push({ type: "supplier", id: s.id, label: s.name, sub: s.city ?? undefined, href: "/business/fornecedores", demo: s.is_demo, score: 1.5 });
  }
  results.sort((a, b) => b.score - a.score);
  return json({ results: results.slice(0, 30).map(({ score: _s, ...r }) => r) });
});
