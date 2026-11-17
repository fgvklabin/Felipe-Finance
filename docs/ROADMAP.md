# Roadmap e limitações conhecidas

## Fase 1 — MVP (concluída)

Landing page, navegação completa, painel de mercados, categorias, páginas de commodity, gráficos interativos (linha, área, velas semanais), comparação, câmbio e indicadores, Business (materiais, impacto, cenários, comparador manual, CSV, Excel e IA), pedidos de cotação, portal do fornecedor, ações e fundos beneficiados, assistente de IA, autenticação com três tipos de conta, workspaces com papéis, watchlist, alertas, administração e LGPD.

## Fase 2 — Inteligência de dados (parcial)

- [x] Ingestão automatizada (BCB, BCE, Banco Mundial, CVM) com retentativas, cache, validação e alertas de dados desatualizados
- [x] Dados financeiros de companhias (DFP) e de fundos (cadastro, cotas, lâminas)
- [x] Correlações históricas com IC e estabilidade
- [x] Resumo diário e notas de mercado geradas a partir dos dados
- [x] Extração de cotações por IA, com verificação humana obrigatória
- [x] Edição mais recente do Pink Sheet (descoberta automática da URL)
- [x] ITR trimestral (resultados por trimestre nas páginas das empresas)
- [ ] Releases de resultados e EBITDA ajustado
- [x] Carteiras de fundos (CDA) para exposição verificada
- [ ] Feeds de notícias autorizados
- [ ] Conab, IBGE, Comex Stat, USDA PSD/WASDE, ANP, EIA

## Fase 3 — Inteligência preditiva (parcial)

- [x] Forecast Engine validado (walk-forward, Diebold-Mariano, intervalos calibrados, arquivo imutável)
- [x] Cenários de compra, simulador, Impact Engine, analisador de curva a termo
- [ ] Modelos com variáveis exógenas (câmbio, clima, estoques) usando XGBoost e LightGBM
- [ ] Avaliação "ao vivo" de previsões passadas contra preços realizados
- [ ] Curvas futuras oficiais (licença de bolsa)

## Fase 4 — Expansão

Mais mercados, fornecedores regionais, integrações autorizadas (e-mail e WhatsApp para pedidos de cotação e alertas), ferramentas corporativas de compras, mercados internacionais, outros idiomas.

## Limitações conhecidas

1. **Pink Sheet é mensal:** o Banco Mundial publica no início de cada mês a média do mês anterior. O mês corrente nunca aparece, e a série mais curta (sorgo) foi descontinuada pela fonte em 2020.
2. **Sem cotações de ações, ETFs ou futuros:** dependem de licença B3/CME/ICE/LME. Valor de mercado, múltiplos e correlação ação × commodity não são exibidos.
3. **Polímeros, químicos, celulose, papéis, aço, etanol e diesel** são demonstrativos (índice base 100) até a contratação de provedores.
4. **Carteira de fundos (CDA)** tem defasagem de até 90 dias, omite posições confidenciais, mostra futuros só com a direção e não informa hedge cambial. O simulador estima só a parte direta da carteira; fundos sem CDA recente continuam com exposição inferida do nome.
5. **CSNA3** não consta no FCA da CVM (o registro traz o código "4030") e permanece sinalizado.
6. **IA:** o caminho com LLM (chat e extração de PDF/imagem) foi implementado conforme o SDK oficial, mas **não foi testado ao vivo** nesta sessão (sem chave de API disponível). O modo sem LLM foi testado.
7. **Inglês** cobre a navegação e os rótulos principais; o conteúdo analítico está em português.
8. **Rate limit em memória:** adequado para uma instância; use Redis com várias.
9. **USD/CLP** indisponível (sem fonte aberta).
10. Calendário com datas **estimadas** para IPCA, IBC-Br e Pink Sheet. Copom, WASDE e resultados de empresas são cadastrados por administradores com link da fonte.
11. Next.js 15.5 (estável). A migração para a série 16 fica para depois do MVP.
