"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Database, Languages, LogOut, Menu, Moon, Search, Sun, User as UserIcon, X } from "lucide-react";
import { SearchDialog } from "./SearchDialog";
import { SidebarNav, Logo } from "./Sidebar";
import type { Locale } from "@/lib/format";
import { t } from "@/lib/i18n";
import { btnClass, cn } from "../ui";

export function setPref(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

interface Props {
  locale: Locale; theme: "dark" | "light"; dataMode: "all" | "real";
  user: { name: string; email: string; is_admin: boolean; account_type: string } | null; unread: number;
}

export function Topbar({ locale, theme, dataMode, user, unread }: Props) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setPref("avm_theme", next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
    router.refresh();
  };
  const toggleLang = () => {
    setPref("avm_lang", locale === "pt" ? "en" : "pt");
    router.refresh();
  };
  const toggleData = () => {
    setPref("avm_data", dataMode === "all" ? "real" : "all");
    router.refresh();
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur md:px-5">
        <button className={cn(btnClass("ghost", "sm"), "lg:hidden")} onClick={() => setDrawer(true)} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-left text-sm text-muted hover:border-line-strong md:max-w-xl"
        >
          <Search size={15} />
          <span className="hidden truncate sm:inline">{t("search.placeholder", locale)}</span>
          <span className="truncate sm:hidden">Buscar</span>
          <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] md:inline">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={toggleData}
            title={dataMode === "all" ? "Exibindo dados reais e séries de demonstração. Clique para ver somente dados reais." : "Exibindo somente dados reais. Clique para incluir demonstração."}
            className={cn(
              "hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold uppercase tracking-wide sm:flex",
              dataMode === "real" ? "border-emerald-500/40 text-emerald-500" : "border-violet-500/40 text-violet-400",
            )}
          >
            <Database size={13} />
            {dataMode === "real" ? t("mode.real", locale) : t("mode.all", locale)}
          </button>
          <button className={cn(btnClass("ghost", "sm"), "max-sm:hidden")} onClick={toggleLang} title="Idioma / Language" aria-label="Alternar idioma">
            <Languages size={16} />
            <span className="text-[11px] font-semibold">{locale.toUpperCase()}</span>
          </button>
          <button className={btnClass("ghost", "sm")} onClick={toggleTheme} aria-label="Alternar tema">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user ? (
            <>
              <Link href="/alertas" className={cn(btnClass("ghost", "sm"), "relative")} aria-label="Notificações">
                <Bell size={16} />
                {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-coral" />}
              </Link>
              <div className="relative">
                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 text-xs font-semibold text-white" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu do usuário">
                  {user.name.slice(0, 1).toUpperCase()}
                </button>
                {menuOpen && (
                  <div className="panel absolute right-0 top-10 z-40 w-60 p-2 text-sm" onMouseLeave={() => setMenuOpen(false)}>
                    <div className="border-b border-line px-2 pb-2">
                      <div className="truncate font-medium">{user.name}</div>
                      <div className="truncate text-xs text-muted">{user.email}</div>
                    </div>
                    <Link href="/configuracoes" className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-2"><UserIcon size={14} /> {t("nav.settings", locale)}</Link>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel-2"><LogOut size={14} /> {t("auth.logout", locale)}</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className={btnClass("ghost", "sm")}>{t("auth.login", locale)}</Link>
              <span className="hidden sm:block"><Link href="/cadastro" className={btnClass("primary", "sm")}>{t("auth.register", locale)}</Link></span>
            </>
          )}
        </div>
      </header>
      {dataMode === "all" && (
        <div className="border-b border-violet-500/20 bg-violet-500/5 px-4 py-1 text-center text-[11px] text-fg-2 md:px-5">
          Itens <span className="font-semibold text-violet-400">DEMO</span> são apenas demonstração.{" "}
          <button className="underline" onClick={toggleData}>Esconder</button>
        </div>
      )}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} locale={locale} />
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-line bg-bg">
            <div className="flex items-center justify-between px-4 py-3">
              <Logo />
              <button className={btnClass("ghost", "sm")} onClick={() => setDrawer(false)} aria-label="Fechar menu"><X size={18} /></button>
            </div>
            <SidebarNav locale={locale} loggedIn={!!user} isAdmin={!!user?.is_admin} accountType={user?.account_type} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
