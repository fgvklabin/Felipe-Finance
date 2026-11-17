import { z } from "zod";
import { HttpError, handler, json, limit, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { currentWorkspace } from "@/lib/business";
import { one, query } from "@/lib/db";
import { publicDocs, retrieve, workspaceDocs } from "@/lib/ai/retrieval";
import { answerOffline, answerWithLlm, llmConfigured, type ChatTurn } from "@/lib/ai/assistant";
import { describeLlmError } from "@/lib/llm";

const Schema = z.object({
  message: z.string().trim().min(2).max(4000),
  conversationId: z.string().uuid().nullable().optional(),
  context: z.object({ path: z.string().max(200).default("/") }).default({ path: "/" }),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(12).default([]),
});

export const POST = handler("ai/chat", async (req) => {
  const user = await getCurrentUser();
  await limit(user ? `ai:${user.id}` : "ai:anon", user ? 120 : 20, 60 * 60_000);
  const b = await parseBody(req, Schema);
  const path = b.context.path.startsWith("/") ? b.context.path : "/";

  // Contexto: dados públicos + (se logado e membro) dados do workspace ativo
  let docs = publicDocs();
  let wsId: string | null = null;
  if (user) {
    const ws = await currentWorkspace(user);
    if (ws) {
      wsId = ws.workspace_id;
      docs = [...docs, ...(await workspaceDocs(ws.workspace_id, ws.workspace_name))];
    }
  }
  const hits = retrieve(b.message, docs, path);

  // Histórico: do banco (usuário logado, conversa própria) ou do cliente (anônimo, não armazenado)
  let history: ChatTurn[] = b.history;
  let conversationId = b.conversationId ?? null;
  if (user && conversationId) {
    const conv = await one("SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2", [conversationId, user.id]);
    if (!conv) throw new HttpError(404, "Conversa não encontrada.");
    history = (await query<ChatTurn>("SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 8", [conversationId])).reverse();
  }

  let answer: string;
  let model = "offline";
  let mode: "llm" | "offline" = "offline";
  if (llmConfigured()) {
    try {
      const r = await answerWithLlm(b.message, hits, history, path);
      answer = r.text;
      model = r.model;
      mode = "llm";
    } catch (e) {
      answer = `${answerOffline(b.message, hits)}\n\n_(${describeLlmError(e)})_`;
    }
  } else {
    answer = answerOffline(b.message, hits);
  }
  const sources = hits.map((d) => ({ title: d.title, url: d.url, asOf: d.asOf, kind: d.scope }));

  if (user) {
    if (!conversationId) {
      const c = await one<{ id: string }>("INSERT INTO ai_conversations (user_id, workspace_id, title) VALUES ($1, $2, $3) RETURNING id", [user.id, wsId, b.message.slice(0, 80)]);
      conversationId = c!.id;
    }
    await query("INSERT INTO ai_messages (conversation_id, role, content, context) VALUES ($1, 'user', $2, $3)", [conversationId, b.message, JSON.stringify({ path })]);
    await query("INSERT INTO ai_messages (conversation_id, role, content, sources, model) VALUES ($1, 'assistant', $2, $3, $4)", [conversationId, answer, JSON.stringify(sources), model]);
    await query("UPDATE ai_conversations SET updated_at = now() WHERE id = $1", [conversationId]);
  }
  await query("INSERT INTO usage_events (user_id, event, path) VALUES ($1, 'ai.chat', $2)", [user?.id ?? null, path]);
  return json({ answer, sources, mode, conversationId });
});
