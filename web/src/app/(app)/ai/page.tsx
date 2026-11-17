import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ChatPanel, type ChatMessage } from "@/components/ai/ChatPanel";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { llmConfigured } from "@/lib/llm";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Avermont AI" };

export default async function AiPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const { q, c } = await searchParams;
  const user = await getCurrentUser();
  const conversations = user ? await query<{ id: string; title: string; updated_at: string }>("SELECT id, title, updated_at FROM ai_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50", [user.id]) : [];
  let initial: ChatMessage[] = [];
  let convId: string | null = null;
  if (user && c && conversations.some((x) => x.id === c)) {
    convId = c;
    initial = (await query<{ role: "user" | "assistant"; content: string; sources: ChatMessage["sources"] }>("SELECT role, content, sources FROM ai_messages WHERE conversation_id = $1 ORDER BY id", [c])).map((m) => ({ role: m.role, content: m.content, sources: m.sources ?? undefined }));
  }
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assistente"
        accent="var(--purple)"
        title="Avermont AI"
        subtitle="Pergunte do seu jeito. Respondo com os dados da plataforma, cito as fontes e aviso quando não sei."
        right={<Badge tone={llmConfigured() ? "green" : "gold"}>{llmConfigured() ? "IA conectada" : "Modo sem IA (só dados)"}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-3">
          <Link href="/ai" className="mb-2 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-purple"><Plus size={14} /> Nova conversa</Link>
          {!user && <p className="px-1 text-xs text-muted"><Link href="/login" className="underline">Entre</Link> para salvar o histórico de conversas.</p>}
          <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
            {conversations.map((x) => (
              <li key={x.id}>
                <Link href={`/ai?c=${x.id}`} className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${x.id === convId ? "bg-panel-2 text-fg" : "text-fg-2 hover:bg-panel-2"}`}>
                  <MessageSquare size={13} className="mt-0.5 shrink-0" />
                  <span className="min-w-0"><span className="block truncate">{x.title}</span><span className="text-[10px] text-muted">{fmtDateTime(x.updated_at)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex h-[calc(100vh-220px)] min-h-[520px] flex-col overflow-hidden">
          <ChatPanel key={convId ?? q ?? "new"} conversationId={convId} initialMessages={initial} loggedIn={!!user} initialQuestion={convId ? undefined : q} />
        </Card>
      </div>
    </div>
  );
}
