# Fontes de dados e integrações

O registro completo, com licença, cobertura, limitações e status de ingestão, está em `web/src/lib/sources-registry.ts` e na página **/fontes** do app.

## Integradas (dados reais)

| Conector | Endpoint | Licença | Frequência | Observações |
|---|---|---|---|---|
| `worldbank_pinksheet` | XLSX "CMO-Historical-Data-Monthly" (thedocs.worldbank.org) | CC BY 4.0 | Mensal | A URL muda a cada edição: o worker a **descobre automaticamente** na página oficial (`www.worldbank.org/en/research/commodity-markets`) e usa `WORLDBANK_PINK_SHEET_URL` como reserva. Edição atual: dados até out/2026. |
| `bcb_ptax` | `olinda.bcb.gov.br/.../PTAX` | Dados públicos (citar BCB) | Diária | USD (30 anos) e EUR (10 anos) |
| `bcb_sgs_*` | `api.bcb.gov.br/dados/serie/bcdata.sgs.{código}` | Dados públicos | Diária/mensal | 432 Selic, 433 IPCA, 13522 IPCA 12m, 24364 IBC-Br |
| `bcb_focus` | `olinda.bcb.gov.br/.../Expectativas` | Dados públicos | Semanal | A API exige espaços como `%20` |
| `ecb_exr` | `data-api.ecb.europa.eu/service/data/EXR` | Reutilização com citação | Diária | Taxas cruzadas e réplica do índice do dólar (não é o DXY® da ICE) |
| `cvm_companies` | `dados.cvm.gov.br` (cad, FCA, DFP) | Dados abertos | Anual | Tickers conferidos no FCA. **CSNA3 não consta no FCA** (o registro traz "4030") e por isso fica sinalizado |
| `cvm_funds` | `dados.cvm.gov.br` (registro_fundo_classe, inf_diario, lâmina) | Dados abertos | Diária/mensal | 13 meses de informes diários (~11 MB por mês). Linhas malformadas da lâmina são descartadas |
| `cvm_cda` | `dados.cvm.gov.br/dados/FI/DOC/CDA` (cda_fi_AAAAMM.zip) | Dados abertos | Mensal | Carteira de cada fundo: peso = valor de mercado ÷ PL; look-through de um nível em cotas de fundos; futuros só com direção; parcela confidencial informada. Usa o mês mais recente em que a parcela confidencial é ≤ 50% |

**Hosts liberados no ambiente desta sessão:** `www.worldbank.org`, `api.bcb.gov.br`, `olinda.bcb.gov.br`, `thedocs.worldbank.org`, `dados.cvm.gov.br`, `api.frankfurter.app`, `data-api.ecb.europa.eu`.

## Exigem licença (exibidas como demonstração ou indisponíveis)

- **CEPEA/ESALQ:** indicadores físicos brasileiros (soja, milho, café, açúcar, etanol, algodão). Exigem autorização para redistribuição comercial.
- **ICIS, Fastmarkets, Argus, S&P Global Commodity Insights, FOEX:** polímeros, químicos, aço, celulose e papéis.
- **B3, CME/CBOT, ICE, LME:** contratos futuros, ações e ETFs (market data).
- **ANBIMA:** dados de fundos além do campo presente no cadastro da CVM.
- **IEA:** energia.
- **FAOSTAT** (CC BY-NC-SA), **OIC** e **ICAC**: verificar termos para uso comercial.

## Planejadas (abertas ou com chave gratuita)

| Fonte | Necessário |
|---|---|
| Conab, IBGE SIDRA, Comex Stat | Liberar hosts |
| USDA PSD/WASDE, EIA, FRED | Chave de API gratuita + liberar hosts |
| ANP (preços de combustíveis) | Liberar host (dados abertos) |
| INMET, NOAA, NASA POWER, Copernicus | Liberar hosts (fase 3: variáveis exógenas) |
| Banco Central de Chile (USD/CLP) | Credenciais da API |
| Feeds de notícias autorizados (RSS) | Lista em `NEWS_FEEDS` + hosts |

## Como adicionar um conector

1. Crie `worker/avermont_worker/sources/<fonte>.py` usando `net.get_json` / `net.download` (retentativas com backoff e cache em disco).
2. Valide os pontos com `validate_points` (descarta inválidos e sinaliza saltos extremos sem alterá-los).
3. Grave com `write_series` e registre a execução em `IngestionLog.record`.
4. Adicione o instrumento em `web/data/catalog/instruments.json` com `dataMode: "real"` e o provedor.
5. Inclua a fonte em `web/src/lib/sources-registry.ts`, com licença e limitações.

## Regras

- Sem scraping de sites restritos e sem contornar paywalls.
- Não presumir que preço visível publicamente pode ser redistribuído.
- Valor indisponível nunca é substituído por número fabricado. Séries demonstrativas são índices base 100, rotuladas como DEMO em todas as telas, na API e na IA.
