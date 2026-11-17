import { describe, expect, it } from "vitest";
import { evaluateAlert, type MarketView } from "../src/lib/alerts";
import { mapRows, parseCsv, parseDate, parseNumber } from "../src/lib/quote-import";
import { analyzeCurve } from "../src/lib/futures";
import { historicalFrequency, simulate } from "../src/lib/simulator";
import { projectPortfolio, selicFactor, valuePositions, type Position } from "../src/lib/portfolio";
import { rateLimit } from "../src/lib/ratelimit";
import { generateEvents } from "../src/lib/calendar";
import { fmtPct, fmtPrice } from "../src/lib/format";

const view = (price: number, d1: number | null = 0.02, date = "2026-11-16"): MarketView => ({
  price: () => ({ value: price, date, d1, m1: 0.05, frequency: "daily", name: "USD/BRL" }),
  forecastDirection: () => ({ direction: "up", status: "ok", central: 5.9 }),
  latestFiscalYear: () => 2025,
  fundExposure: () => "direta_indice",
  latestNoteDate: () => ({ date: "2026-11-16", title: "Nota" }),
});

describe("alertas", () => {
  const base = { id: "a", item_type: "currency", item_ref: "usdbrl", last_state: null } as const;
  it("preço-alvo dispara ao cruzar e só rearma depois de voltar", () => {
    const a1 = evaluateAlert({ ...base, alert_type: "price_above", threshold: 5.5 }, view(5.7));
    expect(a1.triggered).toBe(true);
    const a2 = evaluateAlert({ ...base, alert_type: "price_above", threshold: 5.5, last_state: a1.state }, view(5.8));
    expect(a2.triggered).toBe(false);
    const a3 = evaluateAlert({ ...base, alert_type: "price_above", threshold: 5.5, last_state: a2.state }, view(5.4));
    expect(a3.triggered).toBe(false);
    const a4 = evaluateAlert({ ...base, alert_type: "price_above", threshold: 5.5, last_state: a3.state }, view(5.6));
    expect(a4.triggered).toBe(true);
  });
  it("variação percentual dispara uma vez por observação", () => {
    const a = evaluateAlert({ ...base, alert_type: "fx_move", threshold: 1 }, view(5.7, -0.015));
    expect(a.triggered).toBe(true);
    const b = evaluateAlert({ ...base, alert_type: "fx_move", threshold: 1, last_state: a.state }, view(5.7, -0.015));
    expect(b.triggered).toBe(false);
    expect(evaluateAlert({ ...base, alert_type: "pct_change_up", threshold: 3 }, view(5.7, 0.01)).triggered).toBe(false);
  });
  it("mudança de previsão não dispara na primeira avaliação", () => {
    const a = evaluateAlert({ ...base, alert_type: "forecast_change", threshold: null }, view(5.7));
    expect(a.triggered).toBe(false);
    const b = evaluateAlert({ ...base, alert_type: "forecast_change", threshold: null, last_state: { key: "ok:neutral" } }, view(5.7));
    expect(b.triggered).toBe(true);
  });
  it("curvas futuras sem licença ficam indisponíveis", () => {
    expect(evaluateAlert({ ...base, alert_type: "curve_change", threshold: null }, view(5.7)).unavailable).toBeTruthy();
  });
});

describe("importação de cotações", () => {
  it("lê CSV com ; aspas e números brasileiros", () => {
    const rows = parseCsv('fornecedor;produto;quantidade;preco unitario;moeda;frete;validade\n"Agro ""Sul"" Ltda";Milho;1.000;R$ 1.234,50;BRL;2.500,00;31/12/2026\n');
    const q = mapRows(rows, "csv");
    expect(q).toHaveLength(1);
    expect(q[0].supplier_name).toBe('Agro "Sul" Ltda');
    expect(q[0].quantity).toBe(1000);
    expect(q[0].unit_price).toBeCloseTo(1234.5);
    expect(q[0].freight_total).toBe(2500);
    expect(q[0].valid_until).toBe("2026-12-31");
    expect(q[0].issues).toHaveLength(0);
    expect(q[0].verified).toBe(false); // sempre exige verificação humana
  });
  it("detecta campos inválidos", () => {
    const q = mapRows([["fornecedor", "produto", "quantidade", "preco"], ["", "Milho", "0", "x"]], "xlsx");
    expect(q[0].issues.join(" ")).toMatch(/fornecedor ausente/);
    expect(q[0].issues.join(" ")).toMatch(/quantidade inválida/);
  });
  it("normaliza números e datas", () => {
    expect(parseNumber("1,234.56")).toBeCloseTo(1234.56);
    expect(parseNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(parseDate("5/1/2027")).toBe("2027-01-05");
  });
});

describe("curvas futuras", () => {
  const asOf = new Date("2026-01-01T00:00:00Z");
  it("identifica contango e backwardation", () => {
    const up = analyzeCurve([{ contract: "A", expiration: "2026-03-01", price: 100 }, { contract: "B", expiration: "2026-06-01", price: 103 }], 99, asOf);
    expect(up.structure).toBe("contango");
    expect(up.points[0].basis).toBeCloseTo(1);
    const down = analyzeCurve([{ contract: "A", expiration: "2026-03-01", price: 100 }, { contract: "B", expiration: "2026-06-01", price: 97 }], null, asOf);
    expect(down.structure).toBe("backwardation");
    expect(analyzeCurve([{ contract: "A", expiration: "2026-03-01", price: 100 }], 99, asOf).structure).toBe("insuficiente");
  });
});

describe("simulador", () => {
  it("quantifica só exposições diretas e combina câmbio", () => {
    const r = simulate(
      [{ kind: "commodity", ref: "acucar", label: "Açúcar", weight: 50 }, { kind: "usd", ref: "usd", label: "US$", weight: 25 }, { kind: "stock", ref: "SMTO3", label: "SMTO3", weight: 25 }],
      { commodities: { acucar: 0.1 }, usdbrl: 0.05, rateChangePp: 0, qualitative: [], horizonMonths: 3 },
      { acucar: 0.3, usd: 0.15 },
    );
    expect(r.lines[0].direct).toBeCloseTo(0.5 * (1.1 * 1.05 - 1));
    expect(r.lines[1].direct).toBeCloseTo(0.25 * 0.05);
    expect(r.lines[2].direct).toBeNull(); // ação: sem estimativa numérica
    expect(r.lines[2].effects.some((e) => e.direction === "positive")).toBe(true);
    expect(r.quantifiedWeight).toBeCloseTo(0.75);
  });
  it("frequência histórica de choques", () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 * (1 + (i % 2 ? 0.2 : 0)));
    expect(historicalFrequency(series, 1, 0.1)!.freq).toBeCloseTo(0.5, 1);
  });
});

describe("carteira", () => {
  const pos = (o: Partial<Position>): Position => ({ id: "p", asset_type: "currency", asset_ref: "usdbrl", label: "USD", quantity: 100, entry_price: 5, entry_date: "2026-01-01", manual_price: null, manual_price_date: null, ...o });
  it("valoriza posições e conta as sem preço", () => {
    const v = valuePositions([pos({}), pos({ id: "x", asset_type: "stock" })], (p) => (p.asset_type === "stock" ? { price: null, date: null, source: "", stale: true } : { price: 6, date: "2026-11-16", source: "BCB", stale: false }));
    expect(v.total).toBe(600);
    expect(v.invested).toBe(1000);
    expect(v.missing).toBe(1);
  });
  it("projeção mantém constantes as posições sem previsão", () => {
    const v = valuePositions([pos({}), pos({ id: "s", asset_type: "stock" })], () => ({ price: 10, date: "x", source: "", stale: false }));
    const pr = projectPortfolio(v.positions, (p) => (p.asset_type === "currency" ? { central: 0.1, low: -0.05, high: 0.2 } : null));
    expect(pr.central).toBeCloseTo(1000 * 1.1 + 1000);
    expect(pr.low).toBeCloseTo(950 + 1000);
    expect(pr.uncovered).toBe(1000);
  });
  it("capitaliza pela Selic apenas em dias úteis", () => {
    const pts: [string, number][] = [["2026-01-02", 15], ["2026-01-03", 15], ["2026-01-05", 15]]; // sexta, sábado, segunda
    expect(selicFactor(pts, "2026-01-01", "2026-01-31")).toBeCloseTo(Math.pow(1.15, 2 / 252), 10);
  });
});

describe("utilitários", () => {
  it("rate limit bloqueia após o máximo na janela", () => {
    const k = `t-${Math.random()}`;
    expect([1, 2, 3].map(() => rateLimit(k, 2, 1000, 0))).toEqual([true, true, false]);
    expect(rateLimit(k, 2, 1000, 5000)).toBe(true);
  });
  it("calendário gera Focus às segundas e não gera eventos em fins de semana", () => {
    const ev = generateEvents(new Date("2026-11-16T00:00:00Z"), 14);
    expect(ev.filter((e) => e.id.startsWith("focus-")).every((e) => new Date(`${e.date}T12:00:00Z`).getUTCDay() === 1)).toBe(true);
    expect(ev.every((e) => ![0, 6].includes(new Date(`${e.date}T12:00:00Z`).getUTCDay()))).toBe(true);
  });
  it("formata no padrão brasileiro", () => {
    expect(fmtPct(0.0234)).toBe("+2,3%");
    expect(fmtPrice(14500.4)).toBe("14.500");
  });
});
