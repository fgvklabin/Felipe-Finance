import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, getClient, llmConfigured } from "../llm";
import type { Doc } from "./retrieval";

// System prompt estável (bom para cache de prompt). Contexto dinâmico vai na mensagem do usuário.
export const SYSTEM_PROMPT = `Você é a Avermont AI, assistente de inteligência de commodities da plataforma Avermont (Brasil).

Público: pessoas comuns, compradores de empresas e investidores. Escreva de forma SIMPLES, curta e clara, em português do Brasil (ou no idioma da pergunta), sem jargão — quando precisar de um termo técnico, explique em poucas palavras.

Regras obrigatórias:
1. Use somente os documentos em <contexto> para fatos e números. Cite as fontes como [1], [2] logo após a informação. Informe a data do dado quando relevante.
2. Nunca invente preços, previsões, cotações de fornecedores, demonstrações financeiras, fundos, fontes ou datas. Se a informação não estiver no contexto, diga claramente que a plataforma não tem esse dado.
3. Previsões numéricas vêm apenas do Forecast Engine (no contexto). Você explica os resultados dos modelos; não cria previsões próprias. Se o modelo não superou o passeio aleatório, diga que não há tendência clara.
4. Não dê recomendação individualizada de investimento (comprar/vender ativo específico). Pode explicar relações econômicas e riscos de forma educativa.
5. Diferencie: preço de referência (físico/benchmark), previsão estatística da Avermont, expectativa de mercado (Focus) e cotação de contrato futuro (não integrada).
6. Correlação não é causalidade; mencione quando a relação for instável.
7. Dados marcados como DEMONSTRATIVOS não representam preços reais — avise.
8. Dados de workspace são confidenciais e pertencem ao usuário; use-os apenas para responder a ele.

Formato da resposta (curto, use estes títulos em negrito, omita os que não se aplicarem):
**Resposta direta** — 1 a 3 frases.
**Dados** — 2 a 5 itens com números e fontes [n].
**Por quê** — o raciocínio econômico em linguagem simples.
**Mas atenção** — contrapontos, riscos e incerteza.`;

export interface ChatTurn { role: "user" | "assistant"; content: string }

export function buildContext(docs: Doc[]) {
  return docs.map((d, i) => `[${i + 1}] ${d.title}\nFonte: ${d.source}${d.asOf ? ` · data: ${d.asOf}` : ""}${d.scope === "workspace" ? " · CONFIDENCIAL (workspace do usuário)" : ""}\n${d.body}`).join("\n\n");
}

export async function answerWithLlm(question: string, docs: Doc[], history: ChatTurn[], contextPath: string): Promise<{ text: string; model: string }> {
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    {
      role: "user",
      content: `<pagina_atual>${contextPath}</pagina_atual>\n<contexto>\n${buildContext(docs) || "(nenhum documento relevante encontrado)"}\n</contexto>\n\nPergunta: ${question}`,
    },
  ];
  const resp = await getClient().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages,
  });
  if (resp.stop_reason === "refusal") return { text: "Não posso responder a essa pergunta. Tente reformular com foco em mercados de commodities.", model: resp.model };
  const text = resp.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  return { text: text || "Não consegui gerar uma resposta. Tente novamente.", model: resp.model };
}

/** Resposta sem LLM: organiza os dados recuperados, sem interpretação livre. */
export function answerOffline(question: string, docs: Doc[]): string {
  if (!docs.length) return "**Resposta direta** — Não encontrei dados na plataforma sobre isso. Tente perguntar sobre uma commodity, moeda, empresa ou fundo específico.";
  const top = docs.slice(0, 4);
  return [
    "**Resposta direta** — O assistente de linguagem não está configurado neste servidor, então mostro os dados mais relevantes que a plataforma tem sobre sua pergunta.",
    "**Dados**",
    ...top.map((d, i) => `- **${d.title}** [${i + 1}]: ${d.body.length > 420 ? d.body.slice(0, 420) + "…" : d.body}`),
    "**Mas atenção** — Para uma explicação completa, configure ANTHROPIC_API_KEY no servidor.",
  ].join("\n");
}

export { llmConfigured };
