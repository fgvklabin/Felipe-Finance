"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Maximize2, Sparkles, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";

export function AiWidget({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (pathname === "/ai") return null;
  return (
    <>
      {open && (
        <div className="panel fixed bottom-20 right-3 z-40 flex h-[min(620px,75vh)] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden md:right-6">
          <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-violet-600/20 to-blue-600/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-purple" /> Avermont AI
              <span className="text-[10px] font-normal text-muted">contexto: {pathname}</span>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/ai" className="rounded p-1 text-muted hover:text-fg" aria-label="Abrir em tela cheia"><Maximize2 size={14} /></Link>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:text-fg" aria-label="Fechar"><X size={16} /></button>
            </div>
          </div>
          <ChatPanel compact loggedIn={loggedIn} />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-3 z-40 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-transform hover:scale-[1.03] md:right-6"
        aria-label="Abrir Avermont AI"
      >
        <Sparkles size={17} /> <span className="hidden sm:inline">Avermont AI</span>
      </button>
    </>
  );
}
