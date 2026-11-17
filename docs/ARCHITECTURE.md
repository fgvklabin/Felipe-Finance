# Arquitetura

## Visão geral

```
 Fontes oficiais ──► worker (Python) ──► snapshots JSON (web/data) ──► app Next.js (leitura rápida)
 (BCB, BCE, World      ingestão, validação,      versionados no git           │
  Bank, CVM)           demos, previsões,                │                     ├─► PostgreSQL / Supabase
                       correlações             npm run db:import ─────────────┘   (usuários, workspaces,
                                                                                    cotações, alertas, IA,
                                                                                    auditoria + espelho de
                                                                                    mercado append-only)
```

### Decisões e motivos

| Decisão | Motivo |
|---|---|
| **Monorepo `web/` + `worker/`** | O repositório não tinha stack prévia (só `snake.py`). Next.js atende UI e APIs; Python é a escolha natural para ingestão e modelos (pandas, statsmodels, scikit-learn). |
| **Snapshots JSON versionados** | Os dados de mercado mudam no máximo diariamente. Arquivos estáticos são rápidos, funcionam na Vercel sem banco e criam um histórico auditável no git. O Postgres recebe o mesmo conteúdo via `db:import`. |
| **PostgreSQL com PGlite em desenvolvimento** | As mesmas migrações SQL rodam no Supabase/Postgres e no PGlite (Postgres em WASM), sem credenciais para rodar localmente. |
| **Autenticação própria** | Sessões com token aleatório (só o hash SHA-256 vai ao banco), revogáveis, senhas com bcrypt, rate limit. Funciona sem dependências externas; pode migrar para Supabase Auth se desejado. |
| **Isolamento por workspace na camada de aplicação** | Toda rota de dados empresariais chama `assertWorkspaceAccess` (papéis: owner, admin, buyer, viewer) e filtra por `workspace_id`. Há testes de integração. |
| **Imutabilidade** | Gatilhos bloqueiam UPDATE/DELETE em `historical_prices`, `currency_prices`, `forecast_results`, `forecast_evaluations` e `audit_logs`. Correções entram como novas linhas (`supersedes_id`). |
| **IA explica, modelos preveem** | Todos os números de previsão vêm do Forecast Engine. A Avermont AI recupera documentos verificados (RAG) e cita fontes. Sem `ANTHROPIC_API_KEY`, mostra os dados recuperados. |
| **Next.js 15 / React 19.3** | Versões estáveis com a correção do CVE-2025-55182 (RSC). `postcss` forçado para versão corrigida via `overrides`. |

## Módulos do app (`web/src`)

| Caminho | Responsabilidade |
|---|---|
| `lib/market.ts` | Leitura tipada dos snapshots, com cache por `mtime` |
| `lib/db.ts` | Postgres/PGlite, migrações com checksum, auditoria e log de erros |
| `lib/auth.ts`, `lib/api.ts` | Sessões, papéis, wrapper de rotas (validação Zod, erros, rate limit) |
| `lib/procurement.ts` | Custo total entregue, valor presente, ranking, cenários de compra (puro, testado) |
| `lib/alerts.ts`, `lib/alerts-run.ts` | Avaliação de alertas (puro) e execução com notificações e e-mail |
| `lib/beneficiaries.ts` | Ações e fundos que tendem a ganhar com a alta de cada commodity |
| `lib/impact.ts`, `lib/companies-kb.ts` | Base de relações econômicas e análise qualitativa das companhias |
| `lib/portfolio*.ts`, `lib/simulator.ts` | Carteira diária com projeção e simulador de choques |
| `lib/ai/*` | Recuperação (BM25 + sinônimos + contexto da página + workspace) e chamada ao Claude |
| `lib/plain.ts` | Frases em linguagem simples para resumos |

## Banco de dados

As migrações ficam em `web/db/migrations` e são aplicadas na primeira conexão, registrando um checksum em `schema_migrations`:

- `0001_init.sql`: usuários, sessões, organizações, workspaces, membros, convites, fontes, categorias, commodities, especificações, preços históricos e atuais (views), câmbio, futuros, curvas, modelos e resultados de previsão, avaliações, fornecedores, verificações, pedidos de cotação, cotações, materiais, histórico de compras, companhias, ações, demonstrações, exposições, fundos, ETFs, carteiras de fundos, indicadores, expectativas, notícias, calendário, watchlists, alertas, notificações, caixa de e-mail, conversas de IA, auditoria, erros, feedback e uso.
- `0002_vector.sql`: `knowledge_documents` com coluna `vector(1024)` quando o pgvector existe.
- `0003_seed.sql`: modelos de previsão e fornecedores demonstrativos.
- `0004_portfolios.sql`: carteiras, posições, snapshots diários e dono do fornecedor.

## Segurança

- Cabeçalhos: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Cookies de sessão `httpOnly`, `sameSite=lax`, `secure` em produção. Troca de senha encerra as demais sessões.
- Rate limit em login, cadastro, recuperação, busca, séries, IA e extração. Em várias instâncias, troque por Redis.
- Chaves (Anthropic, Resend, banco) apenas no servidor. Upload de cotações: só PDF/imagem, até 8 MB, e os valores exigem verificação humana.
- LGPD: consentimento no cadastro, exportação completa em JSON, exclusão com anonimização, dados de empresas isolados.
