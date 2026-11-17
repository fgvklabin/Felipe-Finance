// Teste e2e de fumaça: percorre as páginas principais, cria conta empresarial e valida fluxos-chave.
// Uso: BASE_URL=http://localhost:3000 node e2e/smoke.mjs   (requer o pacote "playwright" com Chromium)
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PUBLIC = ["/", "/visao-geral", "/mercados", "/mercados/agricolas", "/mercados/polimeros", "/commodity/soja", "/commodity/pet", "/moedas", "/moedas/usdbrl",
  "/previsoes", "/curvas-futuras", "/impacto", "/noticias", "/calendario", "/fontes", "/beneficiarios?c=ouro", "/empresas/KLBN11", "/simulador", "/ai", "/relatorios/diario", "/login", "/cadastro"];
const PRIVATE = ["/business", "/business/fornecedores", "/business/equipe", "/carteira", "/watchlist", "/alertas", "/configuracoes", "/admin"];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror ${page.url()}: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) problems.push(`console ${page.url()}: ${m.text().slice(0, 200)}`); });

async function visit(path) {
  const r = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120_000 });
  if (!r || r.status() >= 400) problems.push(`HTTP ${r?.status()} em ${path}`);
}

for (const p of PUBLIC) await visit(p);

// Cadastro de empresa + onboarding
const email = `e2e+${Date.now()}@exemplo.com.br`;
await page.goto(`${BASE}/cadastro`, { waitUntil: "networkidle" });
await page.click("text=Empresa compradora");
await page.fill("#name", "Teste E2E");
await page.fill("#email", email);
await page.fill("#password", "senhaSegura123");
await page.fill("#companyName", "Empresa E2E Ltda");
await page.check("input[name=lgpd]");
await page.click('button:has-text("Criar conta gratuita")');
await page.waitForURL("**/onboarding", { timeout: 60_000 });
await page.click('button:has-text("Milho")');
await page.click('button:has-text("Continuar")');
await page.waitForURL("**/business", { timeout: 60_000 });

// Fluxos via API autenticada
const api = await page.evaluate(async () => {
  const j = (u, m, b) => fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.status);
  return {
    quote: await j("/api/business/quotes", "POST", [{ supplier_name: "Fornecedor Real X", product: "Milho", unit: "t", quantity: 100, unit_price: 1200, source: "manual", verified: true, commodity_id: "milho" }]),
    unverifiedRejected: await j("/api/business/quotes", "POST", [{ supplier_name: "Y", product: "Milho", unit: "t", quantity: 1, unit_price: 1, source: "manual", verified: false }]),
    watch: await j("/api/watchlist", "POST", { itemType: "currency", itemRef: "usdbrl" }),
    alert: await j("/api/alerts", "POST", { action: "create", alert_type: "price_below", item_type: "currency", item_ref: "usdbrl", threshold: 4 }),
    portfolio: await j("/api/portfolio", "POST", { action: "create_portfolio", name: "E2E" }),
    ai: await j("/api/ai/chat", "POST", { message: "Por que o dólar está subindo?", context: { path: "/moedas" } }),
    cronDenied: (await fetch("/api/cron/daily")).status,
  };
});
const expected = { quote: 201, unverifiedRejected: 422, watch: 201, alert: 201, portfolio: 201, ai: 200, cronDenied: 401 };
for (const [k, v] of Object.entries(expected)) if (api[k] !== v) problems.push(`API ${k}: esperado ${v}, recebido ${api[k]}`);

for (const p of PRIVATE) await visit(p);
await browser.close();

if (problems.length) {
  console.error(`FALHOU (${problems.length}):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`OK: ${PUBLIC.length + PRIVATE.length} páginas e ${Object.keys(expected).length} fluxos de API`);
