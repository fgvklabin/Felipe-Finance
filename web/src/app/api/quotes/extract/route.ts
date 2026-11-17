import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { HttpError, handler, json, limit, requireApiUser } from "@/lib/api";
import { currentWorkspace } from "@/lib/business";
import { assertWorkspaceAccess } from "@/lib/auth";
import { AI_MODEL, describeLlmError, getClient, llmConfigured } from "@/lib/llm";

// Extração assistida por IA: o modelo LÊ o documento enviado; ele não inventa valores.
// Campos ausentes devem vir como null, e o usuário precisa verificar tudo antes de salvar.
const Extracted = z.object({
  quotes: z.array(
    z.object({
      supplier_name: z.string().nullable(),
      product: z.string().nullable(),
      specification: z.string().nullable(),
      unit: z.string().nullable(),
      quantity: z.number().nullable(),
      unit_price: z.number().nullable(),
      currency: z.enum(["BRL", "USD", "EUR"]).nullable(),
      freight_total: z.number().nullable(),
      tax_pct: z.number().nullable(),
      payment_days: z.number().nullable(),
      delivery_days: z.number().nullable(),
      delivery_location: z.string().nullable(),
      min_order_qty: z.number().nullable(),
      valid_until: z.string().nullable(),
      contact: z.string().nullable(),
      evidence: z.string().describe("Trecho literal do documento que sustenta o preço"),
    }),
  ),
  warnings: z.array(z.string()),
});

const MAX = 8 * 1024 * 1024;
const TYPES: Record<string, "pdf" | "image"> = { "application/pdf": "pdf", "image/png": "image", "image/jpeg": "image", "image/webp": "image", "image/gif": "image" };

export const POST = handler("quotes/extract", async (req) => {
  const u = await requireApiUser();
  const m = await currentWorkspace(u);
  if (!m) throw new HttpError(404, "Workspace não encontrado.");
  await assertWorkspaceAccess(u.id, m.workspace_id, "buyer");
  await limit("extract", 20, 60 * 60_000);
  if (!llmConfigured()) throw new HttpError(501, "Extração por IA indisponível: configure ANTHROPIC_API_KEY no servidor. Use entrada manual, CSV ou Excel.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Envie um arquivo no campo 'file'.");
  const kind = TYPES[file.type];
  if (!kind) throw new HttpError(415, "Formato não suportado para IA. Use PDF ou imagem (PNG, JPG, WEBP).");
  if (file.size > MAX) throw new HttpError(413, "Arquivo maior que 8 MB.");
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const source =
    kind === "pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data } };
  try {
    const resp = await getClient().messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(Extracted) },
      system:
        "Você extrai dados de cotações comerciais de fornecedores (commodities e insumos) a partir de documentos. " +
        "Use somente o que está escrito no documento. Se um campo não aparece, retorne null — nunca estime nem complete. " +
        "Preço unitário deve ser o preço por unidade de medida informada. Percentuais de impostos apenas se explícitos. " +
        "Prazo de pagamento em dias (ex.: '30/60 dias' → use a média e registre um aviso). Datas no formato AAAA-MM-DD. " +
        "Registre em warnings qualquer ambiguidade (moeda, unidade, impostos inclusos ou não, frete CIF/FOB).",
      messages: [{ role: "user", content: [source, { type: "text", text: "Extraia todas as propostas de preço deste documento." }] }],
    });
    if (resp.stop_reason === "refusal") throw new HttpError(422, "O provedor de IA recusou processar este documento.");
    const out = resp.parsed_output;
    if (!out) throw new HttpError(422, "Não foi possível estruturar o documento. Insira os valores manualmente.");
    return json({ ...out, model: resp.model, requiresVerification: true });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, describeLlmError(e));
  }
});
