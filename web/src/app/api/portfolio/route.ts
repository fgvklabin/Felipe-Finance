import { z } from "zod";
import { HttpError, handler, json, parseBody, requireApiUser } from "@/lib/api";
import { one, query } from "@/lib/db";
import { getCompanies } from "@/lib/market";
import { BRL_CURRENCIES, quoteFor } from "@/lib/portfolio-data";

const Create = z.object({ action: z.literal("create_portfolio"), name: z.string().trim().min(1).max(80) });
const AddPos = z.object({
  action: z.literal("add_position"), portfolio_id: z.string().uuid(),
  asset_type: z.enum(["currency", "commodity", "stock", "fund", "cash"]), asset_ref: z.string().min(1).max(40), label: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().max(1e12), entry_price: z.coerce.number().positive().max(1e12).optional(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const SetPrice = z.object({ action: z.literal("set_price"), position_id: z.string().uuid(), manual_price: z.coerce.number().positive().max(1e9) });
const Del = z.object({ action: z.enum(["delete_position", "delete_portfolio"]), id: z.string().uuid() });
const Body = z.discriminatedUnion("action", [Create, AddPos, SetPrice, Del]);

async function ownsPortfolio(userId: string, id: string) {
  if (!(await one("SELECT 1 FROM portfolios WHERE id = $1 AND user_id = $2", [id, userId]))) throw new HttpError(404, "Carteira não encontrada.");
}

export const POST = handler("portfolio", async (req) => {
  const u = await requireApiUser();
  const b = await parseBody(req, Body);
  switch (b.action) {
    case "create_portfolio": {
      const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM portfolios WHERE user_id = $1", [u.id]);
      if ((n?.n ?? 0) >= 10) throw new HttpError(422, "Limite de 10 carteiras.");
      const r = await one("INSERT INTO portfolios (user_id, name) VALUES ($1, $2) RETURNING id", [u.id, b.name]);
      return json(r, 201);
    }
    case "add_position": {
      await ownsPortfolio(u.id, b.portfolio_id);
      if (b.asset_type === "currency" && !BRL_CURRENCIES.includes(b.asset_ref as never)) throw new HttpError(422, "Use moedas cotadas em reais (USD/BRL, EUR/BRL, CNY/BRL).");
      if (b.asset_type === "stock" && !getCompanies().companies.some((c) => c.tickersGiven.includes(b.asset_ref))) throw new HttpError(422, "Ticker fora do universo de empresas ligadas a commodities.");
      const entryDate = b.entry_date ?? new Date().toISOString().slice(0, 10);
      let entry = b.entry_price;
      if (b.asset_type === "cash") entry = 1;
      if (!entry) {
        const q = quoteFor({ id: "", asset_type: b.asset_type, asset_ref: b.asset_ref, label: b.label, quantity: b.quantity, entry_price: 1, entry_date: entryDate, manual_price: null, manual_price_date: null });
        if (!q.price) throw new HttpError(422, "Sem preço disponível para este ativo: informe o preço de entrada.");
        entry = q.price;
      }
      const r = await one(
        "INSERT INTO portfolio_positions (portfolio_id, asset_type, asset_ref, label, quantity, entry_price, entry_date, manual_price, manual_price_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
        [b.portfolio_id, b.asset_type, b.asset_ref, b.label, b.quantity, entry, entryDate, b.asset_type === "stock" ? entry : null, b.asset_type === "stock" ? entryDate : null],
      );
      return json(r, 201);
    }
    case "set_price": {
      const r = await one("UPDATE portfolio_positions p SET manual_price = $2, manual_price_date = current_date FROM portfolios f WHERE p.id = $1 AND f.id = p.portfolio_id AND f.user_id = $3 AND p.asset_type = 'stock' RETURNING p.id", [b.position_id, b.manual_price, u.id]);
      if (!r) throw new HttpError(404, "Posição não encontrada.");
      return json({ ok: true });
    }
    case "delete_position": {
      const r = await query("DELETE FROM portfolio_positions p USING portfolios f WHERE p.id = $1 AND f.id = p.portfolio_id AND f.user_id = $2 RETURNING p.id", [b.id, u.id]);
      if (!r.length) throw new HttpError(404, "Posição não encontrada.");
      return json({ ok: true });
    }
    case "delete_portfolio": {
      await ownsPortfolio(u.id, b.id);
      await query("DELETE FROM portfolios WHERE id = $1", [b.id]);
      return json({ ok: true });
    }
  }
});
