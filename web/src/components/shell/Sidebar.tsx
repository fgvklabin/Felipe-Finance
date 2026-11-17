"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import {
  Bell, Briefcase, Building2, CalendarDays, CandlestickChart, Circle, Coins, Database, Factory, Flame, FlaskConical, FlaskRound, Hexagon, Landmark,
  LayoutDashboard, Layers, LineChart, Lock, Network, Newspaper, Pickaxe, Scale, Settings, ShieldCheck, Sparkles, Spline, Star,
  Trees, TrendingUp, Truck, Wheat, type LucideIcon,
} from "lucide-react";

// Mapa explícito (evita empacotar a biblioteca inteira de ícones no cliente)
const ICONS: Record<string, LucideIcon> = {
  Bell, Briefcase, Building2, CalendarDays, CandlestickChart, Coins, Database, Factory, Flame, FlaskConical, FlaskRound, Hexagon, Landmark,
  LayoutDashboard, Layers, LineChart, Network, Newspaper, Pickaxe, Scale, Settings, Sparkles, Spline, Star, Trees, TrendingUp, Wheat,
};
import { NAV } from "@/lib/nav";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/format";
import { cn } from "../ui";

export function Logo({ compact }: { compact?: boolean }) {
  const gid = `avm-g-${useId().replace(/:/g, "")}`;
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Avermont — início">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="55%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="#0B1423" stroke={`url(#${gid})`} strokeWidth="1.5" />
        <path d="M6 23 L13 9 L17 17 L20 12 L26 23" fill="none" stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="12" r="1.8" fill="#F59E0B" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight text-fg">Avermont</span>
          <span className="block text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted">Commodity Intelligence</span>
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ locale, loggedIn, isAdmin, accountType, onNavigate }: { locale: Locale; loggedIn: boolean; isAdmin: boolean; accountType?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/mercados" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  return (
    <nav className="flex flex-col gap-4 px-3 pb-6" aria-label="Navegação principal">
      {NAV.map((g) => (
        <div key={g.key}>
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{t(g.key, locale)}</div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon] ?? Circle;
              const active = isActive(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                      active ? "bg-panel-2 font-medium text-fg" : "text-fg-2 hover:bg-panel-2/60 hover:text-fg",
                    )}
                  >
                    <Icon size={16} style={{ color: it.color ?? (active ? "var(--brand)" : undefined) }} className={cn(!it.color && !active && "text-muted group-hover:text-fg-2")} />
                    <span className="truncate">{t(it.key, locale)}</span>
                    {it.requiresAuth && !loggedIn && <Lock size={11} className="ml-auto text-muted" aria-label="requer login" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {(accountType === "supplier" || isAdmin) && (
        <div>
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Conta</div>
          {accountType === "supplier" && (
            <Link href="/fornecedor" onClick={onNavigate} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]", isActive("/fornecedor") ? "bg-panel-2 text-fg" : "text-fg-2 hover:bg-panel-2/60")}>
              <Truck size={16} className="text-cyan" /> {t("nav.supplierPortal", locale)}
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" onClick={onNavigate} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]", isActive("/admin") ? "bg-panel-2 text-fg" : "text-fg-2 hover:bg-panel-2/60")}>
              <ShieldCheck size={16} className="text-gold" /> {t("nav.admin", locale)}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
