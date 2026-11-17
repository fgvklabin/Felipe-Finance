import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Integração server-side com Claude. A chave nunca vai ao cliente.
export const AI_MODEL = process.env.AVERMONT_AI_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;

export function llmConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClient(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export function describeLlmError(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "Limite de uso do provedor de IA atingido. Tente novamente em instantes.";
  if (e instanceof Anthropic.AuthenticationError) return "Credencial do provedor de IA inválida (verifique ANTHROPIC_API_KEY).";
  if (e instanceof Anthropic.BadRequestError) return "Requisição recusada pelo provedor de IA.";
  if (e instanceof Anthropic.APIError) return `Erro do provedor de IA (${e.status}).`;
  return "Falha de comunicação com o provedor de IA.";
}
