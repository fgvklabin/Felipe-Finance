"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Locale } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Badge } from "../ui";

interface Result { type: string; id: string; label: string; sub?: string; href: string; demo?: boolean }

const TYPE_LABEL: Record<string, string> = {
  commodity: "Commodity", currency: "Moeda", company: "Empresa", fund: "Fundo", etf: "ETF", supplier: "Fornecedor", indicator: "Indicador", page: "Página",
};

export function SearchDialog({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) {
          setResults((await r.json()).results);
          setIdx(0);
        }
      } catch {
        /* busca cancelada */
      }
    }, 120);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, open]);

  if (!open) return null;
  const go = (r: Result) => {
    onClose();
    setQ("");
    router.push(r.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={onClose} role="dialog" aria-modal aria-label="Busca global">
      <div className="panel w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, results.length - 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
              if (e.key === "Enter" && results[idx]) go(results[idx]);
            }}
            placeholder={t("search.placeholder", locale)}
            className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
            aria-label="Termo de busca"
          />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nenhum resultado para “{q}”.</li>}
          {results.map((r, i) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${i === idx ? "bg-panel-2" : ""}`}
              >
                <Badge tone={r.type === "commodity" ? "green" : r.type === "currency" ? "cyan" : r.type === "company" ? "blue" : r.type === "fund" || r.type === "etf" ? "gold" : "neutral"}>
                  {TYPE_LABEL[r.type] ?? r.type}
                </Badge>
                <span className="truncate text-fg">{r.label}</span>
                {r.demo && <Badge tone="purple">Demo</Badge>}
                {r.sub && <span className="ml-auto truncate text-xs text-muted">{r.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
