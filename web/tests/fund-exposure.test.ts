import { describe, expect, it } from "vitest";
import { exposureFor, exposureText, monthLabel, simExposure } from "../src/lib/fund-exposure";
import { simulate } from "../src/lib/simulator";
import type { Fund, FundHoldings } from "../src/lib/market";

const fund = (o: Partial<Fund>): Fund => ({
  cnpj: "00.000.000/0001-00", cnpjDigits: "00000000000100", name: "FUNDO TESTE OURO", vehicle: "multimercado", classType: "FIF", classification: null,
  anbimaClassification: null, benchmark: null, condominium: null, targetAudience: null, foreign100pct: false, netAssets: 1e8, netAssetsDate: null,
  startDate: null, manager: null, administrator: null, tags: ["ouro"], exposureType: "multimercado_nao_verificada", exposureBasis: "inferida", performance: null, documents: null, ...o,
});
const hold = (exposures: FundHoldings["exposures"]): FundHoldings => ({ month: "2026-10", pl: 1e8, confidentialShare: 0, positions: 10, top: [], futures: [], exposures });

describe("exposição verificada de fundos (CDA)", () => {
  it("sem carteira: usa o nome, rotulado como não verificado", () => {
    expect(exposureFor(fund({}), "ouro")?.basis).toBe("nao_verificada");
    expect(exposureFor(fund({ vehicle: "etf" }), "ouro")?.basis).toBe("nome_indice");
    expect(exposureFor(fund({}), "brent")).toBeNull();
  });
  it("carteira sem a commodity exclui o fundo mesmo com o tema no nome", () => {
    const f = fund({ holdings: hold({ usdbrl: { weight: 0.4, via: ["exterior"], byVia: { exterior: 0.4 }, side: "long", weighted: true } }) });
    expect(exposureFor(f, "ouro")).toBeNull();
  });
  it("peso abaixo de 5% não conta; peso relevante mostra o mês", () => {
    const small = fund({ holdings: hold({ ouro: { weight: 0.02, via: ["cotas de fundos"], byVia: { "cotas de fundos": 0.02 }, side: "long", weighted: true } }) });
    expect(exposureFor(small, "ouro")).toBeNull();
    const big = fund({ holdings: hold({ ouro: { weight: 0.32, via: ["cotas de fundos", "ações"], byVia: { "cotas de fundos": 0.3, "ações": 0.02 }, side: "long", weighted: true } }) });
    const e = exposureFor(big, "ouro")!;
    expect(e.basis).toBe("carteira");
    expect(e.directWeight).toBeCloseTo(0.3);
    expect(exposureText(e)).toContain("out/2026");
  });
  it("futuros: só direção; vendido não aparece como beneficiário", () => {
    const long = fund({ holdings: hold({ ouro: { weight: null, via: ["futuros"], byVia: {}, side: "long", weighted: false } }) });
    expect(exposureFor(long, "ouro")?.basis).toBe("derivativos");
    const short = fund({ holdings: hold({ ouro: { weight: null, via: ["futuros"], byVia: {}, side: "short", weighted: false } }) });
    expect(exposureFor(short, "ouro")).toBeNull();
  });
  it("simulador: não conta o dólar duas vezes para ativo de commodity no exterior", () => {
    const h = hold({
      ouro: { weight: 0.3, via: ["exterior"], byVia: { exterior: 0.3 }, side: "long", weighted: true },
      usdbrl: { weight: 0.5, via: ["exterior"], byVia: { exterior: 0.5 }, side: "long", weighted: true },
      "minerio-ferro": { weight: 0.1, via: ["ações"], byVia: { "ações": 0.1 }, side: "long", weighted: true },
    });
    const fe = simExposure(h)!;
    expect(fe.direct).toEqual({ ouro: 0.3 });
    expect(fe.usd).toBeCloseTo(0.2);
    expect(fe.stocks).toBeCloseTo(0.1);
    const r = simulate([{ kind: "fund", ref: "x", label: "Fundo", weight: 100, fund: fe }], { commodities: { ouro: 0.1 }, usdbrl: 0.05, rateChangePp: 0, qualitative: [], horizonMonths: 3 }, { ouro: 0.2, usd: 0.15 });
    expect(r.lines[0].direct).toBeCloseTo(0.3 * (1.1 * 1.05 - 1) + 0.2 * 0.05);
    expect(r.quantifiedWeight).toBeCloseTo(0.5); // só a parte direta conta como estimada
  });
  it("fundo sem carteira continua qualitativo", () => {
    const r = simulate([{ kind: "fund", ref: "x", label: "Fundo", weight: 100 }], { commodities: { ouro: 0.1 }, usdbrl: 0, rateChangePp: 0, qualitative: [], horizonMonths: 3 }, {});
    expect(r.lines[0].direct).toBeNull();
    expect(r.quantifiedWeight).toBe(0);
  });
  it("rótulo de mês", () => expect(monthLabel("2026-09")).toBe("set/2026"));
});
