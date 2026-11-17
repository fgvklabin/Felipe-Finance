# Avermont

**Understand markets. Anticipate opportunities.**

Plataforma de inteligência de commodities para o Brasil. Conecta commodities físicas aos mercados financeiros com dados oficiais, previsões estatísticas validadas e um assistente de IA que cita fontes.

- **Mercados:** commodities agrícolas, metais, polímeros, químicos, papel e celulose, energia e moedas, com fonte, unidade, data e status de cada número.
- **Previsões (Forecast Engine):** modelos estatísticos e de ML com validação walk-forward, teste de significância contra o passeio aleatório e faixas de incerteza calibradas.
- **Avermont Business (B2B):** custos de compra, impacto de preço e câmbio, cenários de compra, comparador de fornecedores (custo total entregue), pedidos de cotação e portal do fornecedor.
- **Ações e fundos que podem subir com cada commodity:** dados da CVM e canais de transmissão.
- **Ferramentas:** carteira personalizada com registro diário e projeção, simulador de cenários, watchlist, alertas e Avermont AI.

> O B2C (painel "Avermont Invest") foi removido a pedido. A carteira e o simulador foram mantidos como ferramentas.

## Estrutura

```
felipe-finance/
├── web/                 App Next.js 15 (TypeScript, Tailwind v4) — UI, APIs, autenticação, IA
│   ├── src/app/         Páginas (App Router) e rotas de API
│   ├── src/lib/         Domínio: mercado, previsões, compras, alertas, IA, banco
│   ├── db/migrations/   Esquema PostgreSQL (aplicado automaticamente)
│   ├── data/            Snapshots de mercado gerados pelo worker (versionados)
│   ├── scripts/         db-import (snapshots → Postgres)
│   └── tests/           Vitest (lógica + integração com banco)
├── worker/              Worker Python: ingestão, validação, Forecast Engine, correlações
└── docs/                Arquitetura, Forecast Engine, fontes de dados, deploy, roadmap
```

## Rodando localmente

Requisitos: Node 22+, Python 3.11+.

```bash
cd web
cp .env.example .env.local      # opcional: sem DATABASE_URL usa PGlite (Postgres embutido)
npm install
npm run dev                     # http://localhost:3000
```

Em desenvolvimento, o **primeiro usuário cadastrado vira administrador**. Em produção, use `AVERMONT_ADMIN_EMAILS`.

Para atualizar os dados de mercado (as fontes oficiais precisam estar acessíveis na rede):

```bash
cd worker
pip install -r requirements.txt
python -m avermont_worker.run all          # ou etapas: prices fx macro companies funds demo forecast correlations build
```

Para carregar os snapshots no Postgres (tabelas de preços, previsões, companhias e fundos):

```bash
cd web
npm run db:import
```

## Testes

```bash
cd web && npm test && npm run typecheck && npx eslint src tests && npm run build
cd worker && python -m pytest -q
```

| Suíte | O que cobre |
|---|---|
| `web/tests/procurement.test.ts` | Custo total entregue, valor presente, ranking, cenários de compra, exemplo do algodão (+8%) |
| `web/tests/logic.test.ts` | Alertas, importação CSV/Excel, curvas a termo, simulador, carteira, rate limit, calendário |
| `web/tests/db.test.ts` | Migrações reais (PGlite), isolamento entre workspaces, gatilhos append-only, checks de demonstração, senhas |
| `worker/tests/test_forecast.py` | Sem vazamento de dados, previsões insuficientes, frequência incompatível, expiração, 12 meses, falso positivo em passeio aleatório |
| `worker/tests/test_data.py` | Validação de séries, variações, dados desatualizados, réplica do índice do dólar, taxas cruzadas, correlações |

## Dados: o que é real e o que é demonstração

| Área | Status | Fonte |
|---|---|---|
| 29 commodities (grãos, softs, metais, preciosos, energia, fertilizantes, madeira) | **Real**, mensal; edição atual descoberta automaticamente (dados até out/2026) | World Bank Pink Sheet (CC BY 4.0) |
| USD/BRL, EUR/BRL | **Real**, diário | BCB PTAX |
| CNY/BRL, AUD/USD, USD/CAD, USD/NOK, réplica do índice do dólar | **Real (derivado)**, diário | Taxas de referência do BCE |
| Selic, IPCA, IBC-Br, Focus | **Real** | BCB SGS e Olinda |
| 13 companhias: cadastro, tickers, DFP 2022–2025 | **Real** | CVM (FCA, DFP) |
| 240 fundos, ETFs e Fiagros: cadastro, cotas diárias, lâminas | **Real**; exposição inferida do nome/classe | CVM |
| Polímeros, químicos industriais, celulose, papéis, aço, etanol, diesel, cana | **Demonstração** (índice base 100) | Exigem licença (ICIS, Fastmarkets, Argus, S&P, FOEX, CEPEA) ou integração ANP |
| Fornecedores "Demonstrativo Alfa/Beta/Gama" | **Demonstração** (fictícios, sem contato) | — |
| Cotações de fornecedores | **Inseridas pelo usuário** e verificadas por ele | — |
| USD/CLP, contratos futuros, cotações de ações | **Indisponível** | Exigem licença ou credenciais |

Detalhes em [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Forecast Engine](docs/FORECAST_ENGINE.md)
- [Fontes de dados e integrações](docs/DATA_SOURCES.md)
- [Deploy](docs/DEPLOYMENT.md)
- [Roadmap e limitações conhecidas](docs/ROADMAP.md)

## Aviso

Conteúdo educacional e analítico. A Avermont não é instituição financeira, não executa ordens, não custodia recursos e não faz recomendação individualizada de investimento. Previsões são estimativas estatísticas e não garantem preços, retornos ou economias.
