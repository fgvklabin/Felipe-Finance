// Análise de curva a termo: estrutura (contango/backwardation), base contra o spot e carrego anualizado.

export interface CurvePoint { contract: string; expiration: string; price: number; volume?: number | null; openInterest?: number | null }

export interface CurveAnalysis {
  structure: "contango" | "backwardation" | "mista" | "plana" | "insuficiente";
  points: (CurvePoint & { days: number; basis: number | null; basisPct: number | null; annualizedCarry: number | null })[];
  frontToBack: number | null;
}

export function analyzeCurve(points: CurvePoint[], spot: number | null, asOf: Date = new Date()): CurveAnalysis {
  const valid = points
    .filter((p) => p.price > 0 && !Number.isNaN(new Date(p.expiration).getTime()))
    .map((p) => ({ ...p, days: Math.round((new Date(p.expiration).getTime() - asOf.getTime()) / 86400000) }))
    .filter((p) => p.days > 0)
    .sort((a, b) => a.days - b.days);
  const out = valid.map((p) => ({
    ...p,
    basis: spot ? p.price - spot : null,
    basisPct: spot ? p.price / spot - 1 : null,
    annualizedCarry: spot ? Math.pow(p.price / spot, 365 / p.days) - 1 : null,
  }));
  if (out.length < 2) return { structure: "insuficiente", points: out, frontToBack: null };
  const diffs = out.slice(1).map((p, i) => p.price - out[i].price);
  const tol = 1e-9;
  const up = diffs.every((d) => d > tol);
  const down = diffs.every((d) => d < -tol);
  const flat = diffs.every((d) => Math.abs(d) <= tol);
  return {
    structure: flat ? "plana" : up ? "contango" : down ? "backwardation" : "mista",
    points: out,
    frontToBack: out[out.length - 1].price / out[0].price - 1,
  };
}
