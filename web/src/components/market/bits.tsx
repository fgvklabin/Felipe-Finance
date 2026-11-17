import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge, cn } from "../ui";
import { changeClass, fmtDate, fmtDateTime, fmtPct } from "@/lib/format";
import type { DataMode, SourceInfo, Stats } from "@/lib/market";

export function Change({ v, digits = 1, className }: { v: number | null | undefined; digits?: number; className?: string }) {
  return <span className={cn("num", changeClass(v), className)}>{fmtPct(v, digits)}</span>;
}

export function ChangePill({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="num text-muted">—</span>;
  const up = v > 0;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold", up ? "bg-[var(--up-bg)] text-up" : v < 0 ? "bg-[var(--down-bg)] text-down" : "text-muted")}>
      {up ? <ArrowUpRight size={12} /> : v < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
      {fmtPct(v)}
    </span>
  );
}

export function DataBadge({ mode, stale }: { mode: DataMode; stale?: boolean }) {
  if (mode === "demo") return <Badge tone="purple" title="Série sintética para demonstração — não representa preços de mercado">Demo</Badge>;
  if (mode === "unavailable") return <Badge tone="neutral" title="Sem fonte integrada">Indisponível</Badge>;
  if (stale) return <Badge tone="gold" title="A fonte não publicou dados recentes; verifique a data da última observação">Desatualizado</Badge>;
  return <Badge tone="green" title="Dado de fonte oficial ou licenciada">Real</Badge>;
}

export function ForecastArrow({ f }: { f: { status?: string; direction?: string; beatsBaseline?: boolean } | null | undefined }) {
  if (!f || f.status !== "ok") {
    const label = f?.status === "expired" ? "Previsão expirada (fonte desatualizada)" : "Sem previsão confiável";
    return <span className="text-xs text-muted" title={label}>—</span>;
  }
  const title = f.beatsBaseline ? "Modelo validado superou o passeio aleatório" : "Modelo não superou o passeio aleatório: sem viés direcional";
  if (f.direction === "up") return <span title={title} className="inline-flex items-center gap-1 text-xs text-up"><ArrowUpRight size={14} /> Alta</span>;
  if (f.direction === "down") return <span title={title} className="inline-flex items-center gap-1 text-xs text-down"><ArrowDownRight size={14} /> Baixa</span>;
  return <span title={title} className="inline-flex items-center gap-1 text-xs text-muted"><Minus size={14} /> Neutra</span>;
}

export function SourceLine({ source, stats, frequency }: { source?: SourceInfo; stats?: Stats; frequency?: string }) {
  if (!source) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      <span>
        Fonte:{" "}
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-fg">
            {source.label}
          </a>
        ) : (
          source.label
        )}
      </span>
      {source.license && <span>Licença: {source.license}</span>}
      {source.market && <span>Mercado: {source.market}</span>}
      {stats?.lastDate && <span>Última observação: {frequency === "monthly" ? fmtDate(stats.lastDate, "pt", { month: "long", year: "numeric", timeZone: "UTC" }) : fmtDate(stats.lastDate)}</span>}
      {source.delay && <span>Defasagem: {source.delay}</span>}
      {source.ingestedAt && <span>Coletado: {fmtDateTime(source.ingestedAt)}</span>}
    </div>
  );
}

export function Sparkline({ data, width = 96, height = 28, positive }: { data: number[]; width?: number; height?: number; positive?: boolean }) {
  if (!data || data.length < 2) return <span className="text-xs text-muted">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const up = positive ?? data[data.length - 1] >= data[0];
  const color = up ? "var(--up)" : "var(--down)";
  const id = `sg${Math.round(data[0] * 1000)}${data.length}${Math.round(data[data.length - 1] * 1000)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}
