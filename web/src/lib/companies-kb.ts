// Base qualitativa das companhias ligadas a commodities (ações ligadas a commodities).
// Conteúdo descritivo, sem números: valores financeiros vêm exclusivamente da CVM (DFP).
// Toda afirmação deve ser conferida nos relatórios de RI da companhia antes de qualquer decisão.

export interface CompanyKB {
  tickers: string[]; shortName: string; segment: string; products: string[];
  commodityExposure: { commodity: string; direction: "receita" | "custo" | "misto"; note: string }[];
  currency: string; offsets: string[]; keyQuestions: string[];
}

export const COMPANY_KB: CompanyKB[] = [
  {
    tickers: ["KLBN11"], shortName: "Klabin", segment: "Papel e celulose / embalagens",
    products: ["Papéis e cartões para embalagens", "Embalagens de papelão ondulado", "Sacos industriais", "Celulose de mercado (fibra curta, longa e fluff)", "Madeira de florestas plantadas"],
    commodityExposure: [
      { commodity: "celulose-fibra-curta", direction: "receita", note: "Vende celulose de mercado; preço maior tende a ampliar a receita desse segmento." },
      { commodity: "celulose-fibra-longa", direction: "misto", note: "Produz fibra longa (pinus) usada internamente e vendida." },
      { commodity: "papel-kraft", direction: "receita", note: "Preços de papéis e embalagens afetam o segmento de papéis e conversão." },
      { commodity: "madeira", direction: "misto", note: "Base florestal própria reduz dependência de madeira de terceiros." },
      { commodity: "soda-caustica", direction: "custo", note: "Insumo químico do processo de celulose." },
    ],
    currency: "Parte relevante da receita é exportada ou referenciada em dólar; há dívida em moeda estrangeira — a variação cambial tem efeitos operacionais e financeiros opostos.",
    offsets: ["Grande parte da fibra é consumida internamente (integração reduz a alavancagem ao preço da celulose de mercado)", "Custos de energia, químicos e logística", "Endividamento e investimentos de expansão", "Demanda doméstica por embalagens"],
    keyQuestions: ["Qual a participação da celulose de mercado na receita do último trimestre?", "Quanto da dívida está em dólar e qual o hedge?", "Como evoluíram os preços líquidos realizados?"],
  },
  {
    tickers: ["SUZB3"], shortName: "Suzano", segment: "Papel e celulose",
    products: ["Celulose de eucalipto (fibra curta) de mercado", "Papéis de imprimir e escrever", "Papel cartão e tissue"],
    commodityExposure: [
      { commodity: "celulose-fibra-curta", direction: "receita", note: "Principal produto; receita altamente sensível ao preço da celulose e ao câmbio." },
      { commodity: "madeira", direction: "misto", note: "Florestas próprias; custo-caixa depende de distância média e produtividade." },
      { commodity: "soda-caustica", direction: "custo", note: "Insumo químico relevante." },
    ],
    currency: "Receita majoritariamente em dólar (exportações) com custos em reais; dívida relevante em dólar gera variação cambial contábil no resultado financeiro.",
    offsets: ["Expansões de capacidade globais pressionam preços", "Câmbio apreciado reduz a receita em reais", "Resultado financeiro volátil por dívida em dólar"],
    keyQuestions: ["Preço líquido realizado vs. preço de lista na China e Europa", "Custo-caixa de produção", "Alavancagem (dívida líquida/EBITDA ajustado)"],
  },
  {
    tickers: ["VALE3"], shortName: "Vale", segment: "Mineração",
    products: ["Minério de ferro (finos)", "Pelotas", "Níquel", "Cobre"],
    commodityExposure: [
      { commodity: "minerio-ferro", direction: "receita", note: "Principal fonte de receita; sensível ao 62% Fe CFR China e a prêmios de qualidade." },
      { commodity: "niquel", direction: "receita", note: "Metais básicos — parcela menor da receita." },
      { commodity: "cobre", direction: "receita", note: "Metais básicos — parcela menor da receita." },
      { commodity: "brent", direction: "custo", note: "Combustíveis e frete marítimo." },
    ],
    currency: "Receita em dólar e custos parcialmente em reais: real depreciado tende a ampliar margens.",
    offsets: ["Frete Brasil–China mais longo que o da Austrália", "Demanda de aço chinesa", "Questões regulatórias e de barragens", "Volume embarcado"],
    keyQuestions: ["Preço realizado do minério e prêmios", "Custo C1", "Guidance de produção"],
  },
  {
    tickers: ["PETR3", "PETR4"], shortName: "Petrobras", segment: "Petróleo e gás",
    products: ["Exploração e produção (pré-sal)", "Refino e derivados (diesel, gasolina, GLP)", "Gás natural"],
    commodityExposure: [
      { commodity: "brent", direction: "receita", note: "Receita de E&P atrelada ao Brent; derivados seguem política comercial própria." },
      { commodity: "diesel", direction: "receita", note: "Preços domésticos de derivados dependem da política comercial da companhia." },
      { commodity: "gas-natural", direction: "misto", note: "Produtora e importadora de gás/GNL." },
    ],
    currency: "Receitas e investimentos fortemente ligados ao dólar; dívida em dólar.",
    offsets: ["Política de preços de combustíveis no Brasil", "Controle estatal e decisões de investimento/dividendos", "Tributação"],
    keyQuestions: ["Diferença entre preços domésticos e paridade de importação", "Produção do pré-sal", "Política de dividendos"],
  },
  {
    tickers: ["GGBR4"], shortName: "Gerdau", segment: "Siderurgia",
    products: ["Aços longos (vergalhões, perfis)", "Aços planos", "Aços especiais", "Operações no Brasil, América do Norte e América do Sul"],
    commodityExposure: [
      { commodity: "aco", direction: "receita", note: "Preço do aço é a principal variável de receita." },
      { commodity: "minerio-ferro", direction: "custo", note: "Rota de alto-forno consome minério; parte da produção usa sucata." },
      { commodity: "gas-natural", direction: "custo", note: "Energia e gás na produção." },
    ],
    currency: "Operações no exterior (receita em dólar) diversificam a exposição cambial.",
    offsets: ["Importações de aço (especialmente chinês) pressionam preços no Brasil", "Ciclo de construção civil", "Custo de sucata"],
    keyQuestions: ["Spread aço–matéria-prima por região", "Volume de importações e medidas antidumping"],
  },
  {
    tickers: ["CSNA3"], shortName: "CSN", segment: "Siderurgia e mineração",
    products: ["Aços planos", "Minério de ferro (CSN Mineração)", "Cimento", "Logística e energia"],
    commodityExposure: [
      { commodity: "minerio-ferro", direction: "receita", note: "Mineração própria vende minério no mercado." },
      { commodity: "aco", direction: "receita", note: "Siderurgia de aços planos." },
    ],
    currency: "Exportações de minério em dólar; dívida relevante, parte em moeda estrangeira.",
    offsets: ["Alavancagem financeira", "Concorrência de aço importado", "Custos de energia"],
    keyQuestions: ["Contribuição da mineração para o EBITDA", "Endividamento"],
  },
  {
    tickers: ["USIM5"], shortName: "Usiminas", segment: "Siderurgia",
    products: ["Aços planos (laminados a quente, a frio, chapas grossas)", "Minério de ferro (Mineração Usiminas)"],
    commodityExposure: [
      { commodity: "aco", direction: "receita", note: "Preço do aço plano no mercado doméstico." },
      { commodity: "minerio-ferro", direction: "misto", note: "Produz minério, mas é consumidora na siderurgia." },
    ],
    currency: "Custos de matérias-primas (carvão) em dólar; receita majoritariamente doméstica.",
    offsets: ["Importações de aço", "Custo de carvão metalúrgico", "Demanda automotiva e de linha branca"],
    keyQuestions: ["Margem da siderurgia", "Preços de aço importado vs. doméstico"],
  },
  {
    tickers: ["CBAV3"], shortName: "CBA", segment: "Alumínio",
    products: ["Alumínio primário", "Produtos transformados (chapas, folhas, extrudados)", "Geração de energia própria"],
    commodityExposure: [
      { commodity: "aluminio", direction: "receita", note: "Preço LME + prêmio físico determinam a receita." },
      { commodity: "soda-caustica", direction: "custo", note: "Insumo do refino de alumina." },
    ],
    currency: "Preços referenciados em dólar (LME) com custos parcialmente em reais.",
    offsets: ["Custo de energia", "Prêmios regionais", "Importações"],
    keyQuestions: ["Prêmio físico realizado", "Autossuficiência energética"],
  },
  {
    tickers: ["SLCE3"], shortName: "SLC Agrícola", segment: "Agronegócio (produção)",
    products: ["Soja", "Algodão", "Milho", "Terras agrícolas"],
    commodityExposure: [
      { commodity: "soja", direction: "receita", note: "Principal cultura em área." },
      { commodity: "algodao", direction: "receita", note: "Cultura de alto valor no mix." },
      { commodity: "milho", direction: "receita", note: "Segunda safra." },
      { commodity: "ureia", direction: "custo", note: "Fertilizantes são custo relevante." },
      { commodity: "kcl", direction: "custo", note: "Potássio importado." },
    ],
    currency: "Preços das commodities em dólar; vendas antecipadas e hedge cambial são práticas comuns.",
    offsets: ["Hedge e vendas antecipadas defasam o efeito de preços", "Clima e produtividade", "Custo de insumos"],
    keyQuestions: ["Percentual da safra já comercializado e a que preço", "Custo por hectare"],
  },
  {
    tickers: ["AGRO3"], shortName: "BrasilAgro", segment: "Agronegócio (terras e produção)",
    products: ["Aquisição, desenvolvimento e venda de terras", "Produção de grãos, cana, algodão e pecuária"],
    commodityExposure: [
      { commodity: "soja", direction: "receita", note: "Produção agrícola." },
      { commodity: "milho", direction: "receita", note: "Produção agrícola." },
      { commodity: "acucar", direction: "receita", note: "Cana-de-açúcar em parte das fazendas." },
    ],
    currency: "Commodities em dólar; vendas de terras em reais.",
    offsets: ["Resultados de venda de fazendas são irregulares", "Clima"],
    keyQuestions: ["Ganhos com venda de propriedades vs. resultado operacional"],
  },
  {
    tickers: ["SMTO3"], shortName: "São Martinho", segment: "Sucroenergético",
    products: ["Açúcar", "Etanol (cana e milho)", "Energia elétrica (bioeletricidade)"],
    commodityExposure: [
      { commodity: "acucar", direction: "receita", note: "Receita de açúcar, em parte fixada antecipadamente." },
      { commodity: "etanol", direction: "receita", note: "Preço do etanol segue gasolina e mix." },
      { commodity: "milho", direction: "custo", note: "Matéria-prima do etanol de milho." },
      { commodity: "brent", direction: "receita", note: "Indireto: paridade gasolina/etanol." },
    ],
    currency: "Açúcar exportado em dólar; fixações e hedges cambiais.",
    offsets: ["Fixações antecipadas defasam preços", "Custo da cana (ATR) e clima", "Política de preços de combustíveis"],
    keyQuestions: ["Volume fixado de açúcar e preço médio", "Mix açúcar/etanol"],
  },
  {
    tickers: ["TTEN3"], shortName: "3tentos", segment: "Agronegócio (insumos, grãos e indústria)",
    products: ["Varejo de insumos agrícolas", "Originação de grãos", "Esmagamento de soja (farelo, óleo) e biodiesel"],
    commodityExposure: [
      { commodity: "soja", direction: "misto", note: "Originação e matéria-prima do esmagamento." },
      { commodity: "farelo-soja", direction: "receita", note: "Produto da indústria." },
      { commodity: "oleo-soja", direction: "receita", note: "Produto e insumo do biodiesel." },
      { commodity: "ureia", direction: "misto", note: "Revenda de fertilizantes." },
    ],
    currency: "Grãos e derivados com preço em dólar; revenda de insumos com custos importados.",
    offsets: ["Margem de esmagamento", "Risco de crédito de produtores", "Safra no Sul do Brasil"],
    keyQuestions: ["Margem bruta por segmento", "Capital de giro"],
  },
  {
    tickers: ["JALL3"], shortName: "Jalles Machado", segment: "Sucroenergético",
    products: ["Açúcar (inclui orgânico)", "Etanol", "Energia elétrica", "Saneantes"],
    commodityExposure: [
      { commodity: "acucar", direction: "receita", note: "Receita de açúcar convencional e orgânico." },
      { commodity: "etanol", direction: "receita", note: "Receita de etanol." },
    ],
    currency: "Exportações de açúcar referenciadas em dólar.",
    offsets: ["Custo da cana e clima em Goiás", "Prêmio do açúcar orgânico"],
    keyQuestions: ["Participação do orgânico no mix", "Fixações de preço"],
  },
];

export const kbFor = (ticker: string) => COMPANY_KB.find((k) => k.tickers.includes(ticker.toUpperCase())) ?? null;
