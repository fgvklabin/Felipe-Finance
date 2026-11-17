import Link from "next/link";
import { Logo } from "@/components/shell/Sidebar";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Logo />
        <Link href="/visao-geral" className="text-sm text-muted hover:text-fg">Explorar mercados →</Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">{children}</main>
    </div>
  );
}
