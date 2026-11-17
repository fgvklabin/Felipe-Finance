# Avermont Forecast Engine

Código: `worker/avermont_worker/forecast.py`. Testes: `worker/tests/test_forecast.py`.

## Princípios

1. Os números vêm de modelos estatísticos ou de ML, **nunca de LLM**.
2. **Passeio aleatório é a baseline obrigatória.** Um modelo só é publicado se superar o naive fora da amostra **com significância estatística**.
3. **Sem vazamento:** em cada origem, o modelo só vê dados até aquela data (há teste automático).
4. **Incerteza explícita:** intervalos de 80% por quantis empíricos dos erros, com a cobertura observada reportada.
5. **Nada de número sem base:** dados insuficientes, frequência incompatível ou fonte desatualizada geram status explícito ("Dados insuficientes para uma previsão confiável.").

## Modelos candidatos

| Modelo | Observação |
|---|---|
| Passeio aleatório (naive) | Baseline |
| Drift | Tendência média da janela |
| Naive sazonal | Variação média do mesmo mês-calendário (séries mensais) |
| Suavização exponencial (Holt amortecido) | statsmodels |
| ARIMA(1,1,1) | statsmodels, em log-preços |
| Ridge | Previsão direta por horizonte sobre retornos defasados e dummies de mês |
| Ensemble | Mediana de ETS, ARIMA e Ridge |

XGBoost e LightGBM entram na fase 3, junto com variáveis exógenas (câmbio, clima, estoques), porque exigem features além da própria série para justificar a complexidade.

## Validação

- **Walk-forward** com origens expansivas: 60 origens mensais (passo 1) ou 40 diárias (passo 15 pregões).
- As origens se dividem em **seleção** (1ª metade: escolhe o modelo e calibra o intervalo) e **avaliação** (2ª metade: métricas reportadas).
- Métricas: MAE, RMSE (em log), MAPE e acerto direcional (só quando há previsão de direção).
- **Teste de Diebold-Mariano** sobre a perda |erro|, com variância HAC (Newey-West, defasagem = sobreposição dos horizontes) e correção de Harvey-Leybourne-Newbold. Publica-se o modelo apenas com p < 0,05; caso contrário, publica-se o passeio aleatório e a nota explica o motivo.
- Em simulações com passeios aleatórios puros (8 sementes, 32 horizontes), cerca de 9% dos casos passaram com p < 0,10, consistente com o nível nominal. Com p < 0,05 a taxa esperada é ~5%.

## Horizontes e regras de publicação

| Horizonte | Séries mensais | Séries diárias |
|---|---|---|
| 7 dias | não aplicável (frequência) | 5 pregões |
| 30 / 90 / 180 dias | 1 / 3 / 6 meses | 21 / 63 / 126 pregões |
| 12 meses | só com ≥ 15 anos de histórico e cobertura do intervalo entre 65% e 95% | idem |

Séries mensais preveem a **média do mês-alvo** (o Pink Sheet publica médias mensais). Por isso a previsão só expira **depois que o mês-alvo termina** — enquanto a média ainda está em formação, ela segue válida. Séries diárias expiram na data-alvo. Previsões expiradas aparecem no arquivo de auditoria, mas não devem ser usadas.

## Auditoria

Cada execução gera `web/data/market/forecast_archive/<data>_<hash>.json` com SHA-256 e entra no `index.json`. No banco, `forecast_results` e `forecast_evaluations` são append-only.

## Resultados desta implantação (17/11/2026)

- 36 séries modeladas (29 commodities mensais com dados até out/2026 + 7 câmbios diários).
- 119 horizontes publicados; 28 sem justificativa estatística; 4 expirados (sorgo, descontinuado pela fonte em 2020).
- Ganho significativo sobre o passeio aleatório (Diebold–Mariano, p < 0,05): trigo 30d (Ridge), DAP 30d (drift), Brent 30d (ensemble), KCl 180d (Ridge) e ouro 12m (naive sazonal).
- Câmbio: nenhum modelo superou o passeio aleatório com significância (estimativa central = último valor).
