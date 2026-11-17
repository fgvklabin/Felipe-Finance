import { describe, expect, it } from "vitest";
import { quarterAverage, quarterLabel, quarterStory } from "../src/lib/quarters";
import { evaluateAlert, type MarketView } from "../src/lib/alerts";

describe("resultados trimestrais", () => {
  it("rótulo e média do trimestre", () => {
    expect(quarterLabel("2026T3")).toBe("3º tri/2026");
    const monthly: [string, number][] = [["2026-06-01", 9], ["2026-07-01", 10], ["2026-08-01", 20], ["2026-09-01", 30], ["2026-10-01", 99]];
    expect(quarterAverage(monthly, "2026-09-30", "monthly")).toBe(20);
    expect(quarterAverage(monthly, "2026-12-31", "monthly")).toBeNull(); // trimestre incompleto
  });
  it("frases simples", () => {
    const s = quarterStory({ period: "2026T3", end: "2026-09-30", source: "ITR", revenue: 54.5e9, revenueYoY: -0.04, netIncome: 6.5e9, netIncomePrevYear: 14.7e9 }, { name: "minério de ferro", change: 0.05 });
    expect(s[0]).toContain("4% a menos");
    expect(s[1]).toContain("Lucrou R$ 6,5 bi");
    expect(s[2]).toContain("5% acima");
    expect(quarterStory({ period: "2026T3", end: "2026-09-30", source: "ITR", revenue: 1e9, netIncome: -2e8 })[1]).toContain("prejuízo de R$ 200 mi");
  });
  it("alerta de novo resultado dispara com novo trimestre e não com estado antigo", () => {
    const view = (p: string) => ({ latestPeriod: () => p }) as unknown as MarketView;
    const base = { id: "a", item_type: "company", item_ref: "VALE3", alert_type: "company_results", threshold: null } as const;
    const legacy = evaluateAlert({ ...base, last_state: { year: 2025 } }, view("2026T3"));
    expect(legacy.triggered).toBe(false);
    expect(evaluateAlert({ ...base, last_state: legacy.state }, view("2026T3")).triggered).toBe(false);
    expect(evaluateAlert({ ...base, last_state: legacy.state }, view("2026T4")).triggered).toBe(true);
  });
});
