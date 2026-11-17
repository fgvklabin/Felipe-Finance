"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { cn } from "../ui";

type Pt = [string, number];
type Range = "7d" | "1m" | "3m" | "6m" | "1a" | "3a" | "5a" | "10a" | "max";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "1m": 31, "3m": 92, "6m": 183, "1a": 366, "3a": 1096, "5a": 1827, "10a": 3653, max: 1e6 };

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Velas semanais construídas a partir de fechamentos diários (não há OHLC intradiário licenciado). */
function weeklyCandles(points: Pt[]) {
  const out: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[] = [];
  let cur: (typeof out)[number] | null = null;
  let curWeek = "";
  for (const [d, v] of points) {
    const dt = new Date(`${d}T00:00:00Z`);
    const monday = new Date(dt);
    monday.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    const wk = monday.toISOString().slice(0, 10);
    if (wk !== curWeek) {
      if (cur) out.push(cur);
      curWeek = wk;
      cur = { time: (monday.getTime() / 1000) as UTCTimestamp, open: v, high: v, low: v, close: v };
    } else if (cur) {
      cur.high = Math.max(cur.high, v);
      cur.low = Math.min(cur.low, v);
      cur.close = v;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function PriceChart({ points, brlPoints, frequency, unitLabel, demo }: { points: Pt[]; brlPoints?: Pt[]; frequency: "daily" | "monthly"; unitLabel: string; demo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<Range>(frequency === "daily" ? "1a" : "10a");
  const [kind, setKind] = useState<"area" | "line" | "candle">("area");
  const [ccy, setCcy] = useState<"src" | "brl">("src");

  const data = ccy === "brl" && brlPoints?.length ? brlPoints : points;
  const sliced = useMemo(() => {
    if (!data.length) return [];
    const last = new Date(`${data[data.length - 1][0]}T00:00:00Z`).getTime();
    const from = last - RANGE_DAYS[range] * 86400000;
    return data.filter(([d]) => new Date(`${d}T00:00:00Z`).getTime() >= from);
  }, [data, range]);

  const firstDate = data[0]?.[0];
  const spanDays = data.length ? (new Date(data[data.length - 1][0]).getTime() - new Date(firstDate).getTime()) / 86400000 : 0;
  const rangeAvailable = (r: Range) => {
    if (r === "max") return true;
    if (frequency === "monthly" && RANGE_DAYS[r] < 183) return false; // poucos pontos mensais
    return RANGE_DAYS[r] <= spanDays + 31;
  };

  useEffect(() => {
    if (!ref.current) return;
    const text = cssVar("--muted", "#8193b0");
    const grid = cssVar("--border", "#1f3050");
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, fontFamily: "Inter Variable, system-ui, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: false },
      crosshair: { mode: 1 },
      localization: { locale: "pt-BR", priceFormatter: (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 1 : p >= 1 ? 3 : 4 }) },
    });
    chartRef.current = chart;
    const up = sliced.length > 1 && sliced[sliced.length - 1][1] >= sliced[0][1];
    const color = demo ? "#8B5CF6" : up ? "#10B981" : "#EF4444";
    const toTs = (d: string) => (new Date(`${d}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
    if (kind === "candle" && frequency === "daily") {
      const s = chart.addCandlestickSeries({ upColor: "#10B981", downColor: "#EF4444", borderVisible: false, wickUpColor: "#10B981", wickDownColor: "#EF4444" });
      s.setData(weeklyCandles(sliced));
    } else if (kind === "line") {
      const s = chart.addLineSeries({ color, lineWidth: 2 });
      s.setData(sliced.map(([d, v]) => ({ time: toTs(d), value: v })));
    } else {
      const s = chart.addAreaSeries({ lineColor: color, topColor: `${color}55`, bottomColor: `${color}05`, lineWidth: 2 });
      s.setData(sliced.map(([d, v]) => ({ time: toTs(d), value: v })));
    }
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [sliced, kind, frequency, demo]);

  const btn = (active: boolean, disabled = false) =>
    cn("rounded-md px-2 py-1 text-[11px] font-medium", active ? "bg-panel-2 text-fg" : "text-muted hover:text-fg", disabled && "cursor-not-allowed opacity-30 hover:text-muted");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label="Período">
          <button className={btn(false, true)} disabled title="Dados intradiários (24h) exigem feed licenciado">24h</button>
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <button key={r} className={btn(range === r, !rangeAvailable(r))} disabled={!rangeAvailable(r)} onClick={() => setRange(r)} title={!rangeAvailable(r) ? "Período não suportado pela frequência/histórico da série" : undefined}>
              {r === "max" ? "Máx" : r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="Tipo de gráfico">
          <button className={btn(kind === "area")} onClick={() => setKind("area")}>Área</button>
          <button className={btn(kind === "line")} onClick={() => setKind("line")}>Linha</button>
          <button
            className={btn(kind === "candle", frequency !== "daily")}
            disabled={frequency !== "daily"}
            onClick={() => setKind("candle")}
            title={frequency === "daily" ? "Velas semanais construídas a partir de fechamentos diários" : "Velas exigem dados diários; esta fonte é mensal"}
          >
            Velas
          </button>
          <button className={btn(false, true)} disabled title="Volume não é publicado pelas fontes integradas">Volume</button>
        </div>
        {brlPoints && brlPoints.length > 0 && (
          <div className="flex items-center gap-0.5 border-l border-line pl-2" role="group" aria-label="Moeda">
            <button className={btn(ccy === "src")} onClick={() => setCcy("src")}>US$</button>
            <button className={btn(ccy === "brl")} onClick={() => setCcy("brl")} title="Preço internacional convertido pela PTAX média do mês">R$</button>
          </div>
        )}
      </div>
      <div ref={ref} className="h-[360px] w-full" aria-label={`Gráfico de preços em ${unitLabel}`} />
      <div className="flex flex-wrap gap-3 px-3 pb-2 text-[10.5px] text-muted">
        <span>Unidade: {ccy === "brl" ? unitLabel.replace("US$", "R$") : unitLabel}</span>
        <span>Frequência: {frequency === "daily" ? "diária (dias úteis)" : "mensal (média do mês)"}</span>
        {kind === "candle" && <span>Velas semanais construídas a partir de fechamentos diários</span>}
        {ccy === "brl" && <span>Conversão: PTAX média mensal (não é preço físico no Brasil)</span>}
        {demo && <span className="font-semibold text-violet-400">SÉRIE DEMONSTRATIVA — valores sintéticos</span>}
      </div>
    </div>
  );
}
