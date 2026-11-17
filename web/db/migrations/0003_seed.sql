-- Dados de referência e DEMONSTRAÇÃO (claramente marcados).

INSERT INTO forecast_models (id, label, description, version) VALUES
  ('naive', 'Passeio aleatório (naive)', 'Último valor observado; baseline obrigatória.', '1.0.0'),
  ('drift', 'Passeio aleatório com tendência', 'Último valor + tendência média da janela.', '1.0.0'),
  ('seasonal', 'Naive sazonal', 'Último valor + variação média histórica do mesmo mês-calendário.', '1.0.0'),
  ('ets', 'Suavização exponencial (Holt amortecido)', 'statsmodels ExponentialSmoothing, tendência aditiva amortecida, em log.', '1.0.0'),
  ('arima', 'ARIMA(1,1,1)', 'statsmodels ARIMA em log-preços.', '1.0.0'),
  ('ridge', 'Regressão Ridge', 'Previsão direta por horizonte sobre retornos defasados (+ dummies de mês).', '1.0.0'),
  ('ensemble', 'Ensemble (mediana)', 'Mediana de ETS, ARIMA e Ridge.', '1.0.0')
ON CONFLICT (id) DO NOTHING;

-- Fornecedores DEMONSTRATIVOS: fictícios, sem contato, nunca verificados (garantido por CHECK).
INSERT INTO suppliers (name, city, state, commodities, verification_status, is_demo) VALUES
  ('Fornecedor Demonstrativo Alfa (fictício)', 'Cascavel', 'PR', '{milho,farelo-soja}', 'unverified', true),
  ('Fornecedor Demonstrativo Beta (fictício)', 'Rio Verde', 'GO', '{milho,soja,farelo-soja}', 'unverified', true),
  ('Fornecedor Demonstrativo Gama (fictício)', 'Uberlândia', 'MG', '{farelo-soja,oleo-soja}', 'unverified', true);
