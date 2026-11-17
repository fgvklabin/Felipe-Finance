"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react";
import { Markdown } from "./Markdown";
import { Badge, btnClass, cn } from "../ui";

export interface ChatSource { title: string; url?: string | null; asOf?: string | null; kind?: string }
export interface ChatMessage { role: "user" | "assistant"; content: string; sources?: ChatSource[]; mode?: string }

const SUGGESTIONS = [
  "Por que o preço do café está mudando?",
  "Quais empresas podem se beneficiar de celulose mais cara?",
  "Como o dólar afeta a Klabin?",
  "Quais fundos têm exposição divulgada a ouro e moedas?",
  "Como a curva futura difere da previsão da Avermont?",
  "Quais commodities são afetadas pelo crescimento da China?",
];

export function ChatPanel({ conversationId: initialId, initialMessages = [], compact, loggedIn }: { conversationId?: string | null; initialMessages?: ChatMessage[]; compact?: boolean; loggedIn: boolean }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialId ?? null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationId, context: { path: pathname }, history: messages.slice(-8).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Falha ao consultar a Avermont AI.");
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources, mode: data.mode }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto", compact ? "p-3" : "p-4")}>
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-[13px] text-fg-2">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-purple" />
              <p>
                Olá! Eu explico mercados de commodities usando <b>dados verificados da plataforma</b> — preços, previsões validadas, correlações, dados da CVM
                {loggedIn ? " e os dados do seu workspace" : ""}. Sempre cito fontes e datas, e digo quando a informação não existe.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-2.5 py-1 text-left text-[11.5px] text-fg-2 hover:border-purple hover:text-fg">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-xl px-3 py-2", m.role === "user" ? "bg-blue/15 text-[13px] text-fg" : "border border-line bg-panel-2")}>
              {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-line pt-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Fontes consultadas</div>
                  <ul className="space-y-0.5">
                    {m.sources.map((s, j) => (
                      <li key={j} className="flex items-center gap-1 text-[11px] text-muted">
                        <span className="text-fg-2">[{j + 1}]</span>
                        {s.url ? (
                          s.url.startsWith("/") ? (
                            <a href={s.url} className="truncate underline decoration-dotted hover:text-fg">{s.title}</a>
                          ) : (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate underline decoration-dotted hover:text-fg">
                              {s.title} <ExternalLink size={10} />
                            </a>
                          )
                        ) : (
                          <span className="truncate">{s.title}</span>
                        )}
                        {s.asOf && <span className="shrink-0">· {s.asOf}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.mode === "offline" && <Badge tone="gold" className="mt-2">Modo sem LLM — resposta montada a partir dos dados</Badge>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Consultando dados e fontes…
          </div>
        )}
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={compact ? 2 : 3}
          maxLength={4000}
          placeholder="Pergunte sobre commodities, câmbio, empresas, fundos ou seus fornecedores…"
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-bg-2 px-3 py-2 text-[13px] text-fg placeholder:text-muted focus:border-purple focus:outline-none"
          aria-label="Mensagem para a Avermont AI"
        />
        <button type="submit" disabled={busy || !input.trim()} className={cn(btnClass("primary"), "bg-purple hover:bg-violet-600")} aria-label="Enviar">
          <Send size={15} />
        </button>
      </form>
      <p className="px-3 pb-2 text-[10px] text-muted">A Avermont AI explica resultados dos modelos quantitativos; ela não cria previsões numéricas nem faz recomendação de investimento.</p>
    </div>
  );
}
