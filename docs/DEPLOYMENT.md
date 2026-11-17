# Deploy

## 1. Banco (Supabase ou qualquer PostgreSQL 15+)

1. Crie o projeto e copie a connection string (pooler, modo *session*) para `DATABASE_URL`.
2. Opcional: ative a extensão `vector` (pgvector) para a base de conhecimento.
3. As migrações rodam automaticamente na primeira requisição. Para rodar antes, execute `npm run db:import` com `DATABASE_URL` definida: o script aplica as migrações e carrega os dados.

## 2. App web (Vercel)

- **Root directory:** `web`. **Framework:** Next.js. Node 22.
- **Variáveis** (ver `web/.env.example`): `DATABASE_URL`, `APP_URL`, `AVERMONT_ADMIN_EMAILS`, `CRON_SECRET`, `ANTHROPIC_API_KEY` (opcional), `RESEND_API_KEY` + `EMAIL_FROM` (opcional).
- `web/vercel.json` agenda `/api/cron/daily`. A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente. A tarefa avalia alertas e grava o snapshot diário das carteiras.
- Os snapshots de `web/data` vão no build (`outputFileTracingIncludes`).

Para outra hospedagem: `npm run build && npm start` (Node 22) e agende o cron com `curl -H "Authorization: Bearer $CRON_SECRET" https://SEU_DOMINIO/api/cron/daily`.

## 3. Dados (worker)

O workflow `.github/workflows/ingest.yml` roda em dias úteis:

1. executa `python -m avermont_worker.run all`;
2. carrega no Postgres (se houver o secret `DATABASE_URL`);
3. faz commit dos snapshots atualizados, o que dispara novo deploy na Vercel.

Configure no GitHub:
- **Variable** `WORLDBANK_PINK_SHEET_URL` com o link da edição mais recente do Pink Sheet.
- **Secret** `DATABASE_URL`, se quiser a carga no banco.

Alternativas: qualquer agendador (cron, Cloud Run Jobs, Render Cron) rodando o mesmo comando.

## 4. Checklist de produção

- [ ] `DATABASE_URL` aponta para Postgres gerenciado com backups
- [ ] `AVERMONT_ADMIN_EMAILS` definido (em produção, o primeiro usuário **não** vira admin)
- [ ] `CRON_SECRET` forte
- [ ] Domínio e `APP_URL` corretos (links de redefinição de senha)
- [ ] Provedor de e-mail configurado e domínio verificado
- [ ] Rate limit distribuído (Redis/Upstash) se houver várias instâncias
- [ ] Revisão jurídica da política de privacidade e dos avisos regulatórios
- [ ] Licenças de dados contratadas antes de exibir fontes pagas
