import { describe, expect, it } from "vitest";
import { compareProposals, deliveredCost, fxImpact, monthlyRate, priceImpact, purchaseScenarios, rankQuotes, type Material, type Quote } from "../src/lib/procurement";

const fx = { USD: 5.5, EUR: 6.0 };
const q = (o: Partial<Quote>): Quote => ({
  id: "q", supplier_name: "S", quantity: 100, unit: "t", unit_price: 1000, currency: "BRL", freight_total: 0, tax_pct: 0,
  payment_days: 0, delivery_days: 10, min_order_qty: null, valid_until: null, verified_by_user: true, is_demo: false, ...o,
});
const mat: Material = { id: "m", name: "Algodão", unit: "t", monthly_consumption: 100, current_price: 14500, inventory_qty: 50, lead_time_days: 20, storage_cost_pct_month: 0.5, usd_share: 60, essential: true, commodity_id: "algodao" };

describe("custo total entregue", () => {
  it("soma mercadoria, frete e impostos e converte moeda", () => {
    const c = deliveredCost(q({ currency: "USD", unit_price: 200, freight_total: 5000, tax_pct: 10 }), fx, 0);
    expect(c.goods).toBe(100 * 200 * 5.5);
    expect(c.taxes).toBeCloseTo(11000);
    expect(c.total).toBeCloseTo(110000 + 5000 + 11000);
    expect(c.perUnit).toBeCloseTo(1260);
    expect(c.warnings.some((w) => w.includes("exposição cambial"))).toBe(true);
  });
  it("valor presente premia prazo de pagamento maior", () => {
    const r = monthlyRate(12);
    const a = deliveredCost(q({ payment_days: 0 }), fx, r);
    const b = deliveredCost(q({ payment_days: 90 }), fx, r);
    expect(b.presentValue).toBeLessThan(a.presentValue);
    expect(b.total).toBe(a.total);
  });
  it("ranqueia pelo custo total, não pelo preço de tabela", () => {
    const cheapPriceExpensiveFreight = q({ id: "a", unit_price: 950, freight_total: 20000 });
    const higherPriceFreeFreight = q({ id: "b", unit_price: 1000, freight_total: 0 });
    const r = rankQuotes([cheapPriceExpensiveFreight, higherPriceFreeFreight], fx, 0);
    expect(r[0].quote.id).toBe("b");
  });
  it("cotações não verificadas, demo ou vencidas ficam inelegíveis e vão para o fim", () => {
    const r = rankQuotes([q({ id: "demo", unit_price: 1, is_demo: true }), q({ id: "unv", unit_price: 2, verified_by_user: false }), q({ id: "old", unit_price: 3, valid_until: "2000-01-01" }), q({ id: "ok", unit_price: 999 })], fx, 0);
    expect(r[0].quote.id).toBe("ok");
    expect(r.slice(1).every((x) => !x.cost.eligible)).toBe(true);
  });
  it("calcula a diferença entre propostas", () => {
    const a = deliveredCost(q({ unit_price: 1000 }), fx, 0);
    const b = deliveredCost(q({ unit_price: 1100 }), fx, 0);
    const d = compareProposals(a, b, 500);
    expect(d.diffPerUnit).toBeCloseTo(100);
    expect(d.diffTotal).toBeCloseTo(50000);
    expect(d.cheaper).toBe("A");
  });
});

describe("impacto e cenários de compra", () => {
  it("exemplo do briefing: 100 t/mês de algodão, alta de 8%", () => {
    const i = priceImpact(mat, 0.08);
    expect(i.monthlySpend).toBe(1_450_000);
    expect(i.delta).toBeCloseTo(116_000);
    expect(i.annualDelta).toBeCloseTo(1_392_000);
  });
  it("choque cambial afeta só a parcela dolarizada", () => {
    expect(fxImpact(mat, 0.05).delta).toBeCloseTo(1_450_000 * 0.6 * 0.05);
  });
  it("não permite adiar quando o estoque não cobre prazo de entrega + adiamento, e alerta material essencial", () => {
    const sc = purchaseScenarios(mat, { horizonMonths: 3, changeCentral: -0.05, changeLow: -0.15, changeHigh: 0.1, rateMonthly: 0.01, fixedPremiumPct: 2, delayMonths: 1, altSupplierPrice: null, passThrough: 1 });
    const delay = sc.find((s) => s.id === "delay")!;
    expect(delay.feasible).toBe(false);
    expect(delay.expected).toBeNull();
    expect(delay.warnings.join(" ")).toMatch(/essencial/);
    expect(sc.find((s) => s.id === "alternative")!.feasible).toBe(false);
  });
  it("compra gradual tem faixa entre os cenários baixo e alto e preço fixo inclui o prêmio", () => {
    const sc = purchaseScenarios({ ...mat, inventory_qty: 1000 }, { horizonMonths: 6, changeCentral: 0.06, changeLow: -0.1, changeHigh: 0.2, rateMonthly: 0.01, fixedPremiumPct: 3, delayMonths: 1, altSupplierPrice: 14000, passThrough: 1 });
    const g = sc.find((s) => s.id === "gradual")!;
    expect(g.low!).toBeLessThan(g.expected!);
    expect(g.high!).toBeGreaterThan(g.expected!);
    expect(sc.find((s) => s.id === "fixed")!.expected).toBeCloseTo(600 * 14500 * 1.03);
    expect(sc.find((s) => s.id === "alternative")!.expected).toBeCloseTo(600 * 14000);
    expect(sc.find((s) => s.id === "delay")!.feasible).toBe(true);
  });
});
