import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

export function cn(...a: (string | false | null | undefined)[]) {
  return clsx(a);
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("panel animate-fade-up", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, right, accent }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; accent?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          {accent && <span className="inline-block h-3 w-1 rounded-full" style={{ background: accent }} />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

type Tone = "neutral" | "green" | "red" | "blue" | "purple" | "gold" | "cyan" | "orange";
const TONES: Record<Tone, string> = {
  neutral: "bg-panel-2 text-fg-2 border-line",
  green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  red: "bg-red-500/10 text-red-500 border-red-500/30",
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  purple: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  gold: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  orange: "bg-orange-500/10 text-orange-500 border-orange-500/30",
};

export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function ButtonLink({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "outline"; className?: string }) {
  return (
    <Link href={href} className={cn(btnClass(variant), className)}>
      {children}
    </Link>
  );
}

export function btnClass(variant: "primary" | "ghost" | "outline" | "danger" = "primary", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
    variant === "primary" && "bg-brand text-white hover:bg-emerald-600",
    variant === "ghost" && "text-fg-2 hover:bg-panel-2 hover:text-fg",
    variant === "outline" && "border border-line-strong text-fg hover:bg-panel-2",
    variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
  );
}

export const inputClass =
  "h-9 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg placeholder:text-muted focus:border-blue focus:outline-none";
export const labelClass = "mb-1 block text-xs font-medium text-fg-2";

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("num mt-0.5 truncate text-lg font-semibold", tone)}>{value}</div>
      {sub && <div className="num truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, accent, right, eyebrow }: { title: ReactNode; subtitle?: ReactNode; accent?: string; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: accent ?? "var(--brand)" }}>{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Notice({ tone = "gold", title, children }: { tone?: "gold" | "blue" | "red" | "green"; title?: ReactNode; children: ReactNode }) {
  const map = {
    gold: "border-amber-500/30 bg-amber-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    red: "border-red-500/30 bg-red-500/5",
    green: "border-emerald-500/30 bg-emerald-500/5",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 text-xs leading-relaxed text-fg-2", map[tone])}>
      {title && <div className="mb-0.5 font-semibold text-fg">{title}</div>}
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <div className="text-sm font-medium text-fg-2">{title}</div>
      {children && <div className="mt-1 max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-6 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
      {children ??
        "Conteúdo educacional e analítico. A Avermont não é instituição financeira, não executa ordens, não custodia recursos e não oferece recomendação individualizada de investimento. Previsões são estimativas estatísticas com incerteza e não garantem preços, retornos ou economias futuras."}
    </p>
  );
}
