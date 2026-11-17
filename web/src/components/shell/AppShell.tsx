import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { SidebarNav, Logo } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AiWidget } from "../ai/AiWidget";
import { t } from "@/lib/i18n";

export async function AppShell({ children }: { children: ReactNode }) {
  const [prefs, user] = await Promise.all([getPrefs(), getCurrentUser()]);
  let unread = 0;
  if (user) {
    const r = await one<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [user.id]).catch(() => null);
    unread = r?.n ?? 0;
  }
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-line bg-bg-2/60 lg:block">
        <div className="px-5 pb-4 pt-4">
          <Logo />
        </div>
        <SidebarNav locale={prefs.locale} loggedIn={!!user} isAdmin={!!user?.is_admin} accountType={user?.account_type} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          locale={prefs.locale}
          theme={prefs.theme}
          dataMode={prefs.dataMode}
          unread={unread}
          user={user ? { name: user.name, email: user.email, is_admin: user.is_admin, account_type: user.account_type } : null}
        />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-5 md:px-6">{children}</main>
        <footer className="border-t border-line px-6 py-4 text-[11px] text-muted">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} Avermont — Understand markets. Anticipate opportunities.</span>
            <span className="max-w-3xl">{t("disclaimer.short", prefs.locale)}</span>
          </div>
        </footer>
      </div>
      <AiWidget loggedIn={!!user} />
    </div>
  );
}
