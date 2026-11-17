// Avermont Impact Engine — base de relações econômicas (qualitativa, revisável).
// Direções descrevem o efeito de PRIMEIRA ORDEM de uma ALTA no "driver". Não são previsões nem
// recomendações: o efeito líquido depende de contratos, hedge, câmbio, repasse e alavancagem.

export type Direction = "positive" | "negative" | "mixed";

export interface ImpactEffect {
  target: string; targetType: "company" | "industry" | "currency" | "fund_type" | "consumer";
  ref?: string; direction: Direction; channel: string;
}

export interface ImpactLink {
  driver: string; driverLabel: string; scenario: string; explanation: string;
  effects: ImpactEffect[]; counterfactors: string[]; uncertainty: "alta" | "média" | "baixa";
  limitations: string; correlationWith?: string[]; sources: string[];
}

export const IMPACT_LINKS: ImpactLink[] = [
  {
    driver: "celulose-fibra-curta", driverLabel: "Celulose (fibra curta)", scenario: "Alta do preço da celulose",
    explanation: "Produtoras de celulose de mercado vendem majoritariamente em dólar com custos majoritariamente em reais; preço maior tende a ampliar margem. Para quem compra celulose (papel tissue, papéis especiais), o custo de fibra sobe.",
    effects: [
      { target: "Suzano", ref: "SUZB3", targetType: "company", direction: "positive", channel: "Receita de celulose de mercado" },
      { target: "Klabin", ref: "KLBN11", targetType: "company", direction: "mixed", channel: "Vende celulose de mercado, mas boa parte da fibra é usada internamente em papéis e embalagens" },
      { target: "Fabricantes de papel tissue e imprimir não integrados", targetType: "industry", direction: "negative", channel: "Custo de matéria-prima" },
      { target: "Fabricantes de embalagens que compram papel", targetType: "industry", direction: "negative", channel: "Repasse do custo de papel" },
    ],
    counterfactors: ["Real apreciado reduz a receita em reais", "Novas capacidades globais pressionam preço", "Preço de lista ≠ preço realizado (descontos regionais)", "Hedge cambial e endividamento em dólar"],
    uncertainty: "média",
    limitations: "Preço de celulose integrado nesta versão é DEMONSTRATIVO (exige licença FOEX/Fastmarkets); a relação é qualitativa.",
    correlationWith: ["usdbrl"], sources: ["Relatórios trimestrais das companhias (CVM/RI)", "Descrição de atividade no FCA/CVM"],
  },
  {
    driver: "algodao", driverLabel: "Algodão", scenario: "Alta do preço do algodão",
    explanation: "Produtores de algodão (Cerrado) recebem mais por unidade vendida; fiações e confecções enfrentam custo maior de fibra, com repasse limitado em mercados competitivos.",
    effects: [
      { target: "SLC Agrícola", ref: "SLCE3", targetType: "company", direction: "positive", channel: "Algodão é parte relevante do mix de culturas" },
      { target: "BrasilAgro", ref: "AGRO3", targetType: "company", direction: "positive", channel: "Produção agrícola própria" },
      { target: "Fiações e tecelagens", targetType: "industry", direction: "negative", channel: "Custo de fibra" },
      { target: "Varejo de vestuário", targetType: "industry", direction: "negative", channel: "Custo de produto, se não repassado" },
    ],
    counterfactors: ["Vendas antecipadas e hedge travam preços de safras", "Substituição por poliéster", "Câmbio", "Clima pode reduzir o volume produzido"],
    uncertainty: "média", limitations: "O benchmark (Cotlook A) é internacional; o preço no Brasil difere por base e frete.",
    correlationWith: ["usdbrl"], sources: ["World Bank Pink Sheet (preço)", "DFP/CVM (receitas das companhias)"],
  },
  {
    driver: "acucar", driverLabel: "Açúcar", scenario: "Alta do preço do açúcar",
    explanation: "Usinas do Centro-Sul podem direcionar mais ATR ao açúcar e elevar a receita; o etanol tende a acompanhar via mix e paridade. Indústrias de alimentos e bebidas têm custo maior.",
    effects: [
      { target: "São Martinho", ref: "SMTO3", targetType: "company", direction: "positive", channel: "Receita de açúcar" },
      { target: "Jalles Machado", ref: "JALL3", targetType: "company", direction: "positive", channel: "Receita de açúcar (inclui orgânico)" },
      { target: "Indústria de alimentos e bebidas", targetType: "industry", direction: "negative", channel: "Custo de insumo" },
      { target: "Fundos com exposição a ações sucroalcooleiras", targetType: "fund_type", direction: "mixed", channel: "Indireta, via ações — depende da carteira" },
    ],
    counterfactors: ["Fixações de preço e hedge (vendas antecipadas)", "Custos de cana e diesel", "Política de exportação da Índia", "Câmbio"],
    uncertainty: "média", limitations: "Efeito em fundos só pode ser estimado com carteira divulgada (CDA).",
    correlationWith: ["usdbrl", "brent"], sources: ["World Bank Pink Sheet", "DFP/CVM"],
  },
  {
    driver: "usdbrl", driverLabel: "Dólar (USD/BRL)", scenario: "Depreciação do real (dólar sobe)",
    explanation: "Exportadores com receita dolarizada e custos em reais tendem a ganhar margem; importadores de insumos e empresas com dívida em dólar sem hedge perdem. Para o consumidor, bens comercializáveis encarecem.",
    effects: [
      { target: "Suzano", ref: "SUZB3", targetType: "company", direction: "positive", channel: "Receita em dólar; dívida em dólar gera efeito contábil oposto" },
      { target: "Vale", ref: "VALE3", targetType: "company", direction: "positive", channel: "Receita em dólar" },
      { target: "Petrobras", ref: "PETR4", targetType: "company", direction: "mixed", channel: "Receita atrelada a preços internacionais; política de preços domésticos" },
      { target: "Klabin", ref: "KLBN11", targetType: "company", direction: "mixed", channel: "Exportações e dívida em dólar" },
      { target: "Importadores de fertilizantes, resinas e químicos", targetType: "industry", direction: "negative", channel: "Custo de importação" },
      { target: "Indústria doméstica com insumos importados", targetType: "industry", direction: "negative", channel: "Custo" },
    ],
    counterfactors: ["Hedge cambial", "Dívida em dólar (perda contábil)", "Preços das commodities podem cair junto com o real", "Inflação e reação do Copom"],
    uncertainty: "alta", limitations: "A relação real–commodities muda com risco fiscal e diferencial de juros; correlações históricas são instáveis.",
    correlationWith: ["soja", "minerio-ferro", "brent", "ouro"], sources: ["BCB PTAX", "DFP/CVM"],
  },
  {
    driver: "cobre", driverLabel: "Cobre", scenario: "Alta do preço do cobre",
    explanation: "Mineradoras com produção de cobre ganham receita; fabricantes de fios, cabos, motores e equipamentos elétricos, e a construção, enfrentam custo maior.",
    effects: [
      { target: "Vale", ref: "VALE3", targetType: "company", direction: "positive", channel: "Metais básicos (cobre e níquel) — parcela menor que o minério de ferro" },
      { target: "Fabricantes de equipamentos elétricos e cabos", targetType: "industry", direction: "negative", channel: "Custo de metal (contratos costumam indexar à LME)" },
      { target: "Construção civil", targetType: "industry", direction: "negative", channel: "Instalações elétricas" },
      { target: "Peso chileno (USD/CLP)", targetType: "currency", direction: "negative", channel: "USD/CLP tende a cair (peso se aprecia) com cobre em alta — relação instável" },
    ],
    counterfactors: ["Repasse via indexação LME", "Demanda chinesa", "Dólar global"],
    uncertainty: "média", limitations: "USD/CLP não está integrado (sem fonte aberta); a correlação não pode ser calculada aqui.",
    correlationWith: ["audusd", "dxy"], sources: ["World Bank Pink Sheet", "DFP/CVM"],
  },
  {
    driver: "minerio-ferro", driverLabel: "Minério de ferro", scenario: "Alta do minério de ferro",
    explanation: "Mineradoras de ferro ampliam receita; siderúrgicas não integradas pagam mais pela matéria-prima, enquanto siderúrgicas com minas próprias podem se beneficiar parcialmente.",
    effects: [
      { target: "Vale", ref: "VALE3", targetType: "company", direction: "positive", channel: "Principal produto" },
      { target: "CSN", ref: "CSNA3", targetType: "company", direction: "mixed", channel: "Possui mineração (CSN Mineração) e siderurgia" },
      { target: "Usiminas", ref: "USIM5", targetType: "company", direction: "mixed", channel: "Possui mineração, mas é consumidora líquida na siderurgia" },
      { target: "Gerdau", ref: "GGBR4", targetType: "company", direction: "negative", channel: "Custo de matéria-prima (rota de alto-forno)" },
      { target: "Dólar australiano (AUD/USD)", targetType: "currency", direction: "positive", channel: "Austrália é maior exportadora" },
    ],
    counterfactors: ["Preço do aço pode subir junto (repasse)", "Prêmios de qualidade", "Frete marítimo", "Política siderúrgica chinesa"],
    uncertainty: "média", limitations: "O benchmark é 62% Fe CFR China; preço realizado pelas empresas difere.",
    correlationWith: ["audusd", "usdbrl", "cnybrl"], sources: ["World Bank Pink Sheet", "DFP/CVM"],
  },
  {
    driver: "brent", driverLabel: "Petróleo Brent", scenario: "Alta do petróleo",
    explanation: "Produtoras de petróleo ampliam receita; transportadoras, companhias aéreas e indústrias intensivas em diesel e derivados (resinas, fertilizantes nitrogenados) enfrentam custos maiores. O etanol ganha competitividade.",
    effects: [
      { target: "Petrobras", ref: "PETR4", targetType: "company", direction: "positive", channel: "Exploração e produção; refino depende da política de preços" },
      { target: "Usinas de etanol", targetType: "industry", direction: "positive", channel: "Paridade gasolina/etanol" },
      { target: "Transporte e logística", targetType: "industry", direction: "negative", channel: "Diesel" },
      { target: "Coroa norueguesa e dólar canadense", targetType: "currency", direction: "positive", channel: "Exportadores de energia" },
    ],
    counterfactors: ["Política de preços de combustíveis no Brasil", "Tributação", "Câmbio", "Recessão global reduz demanda"],
    uncertainty: "alta", limitations: "Efeito na Petrobras depende de decisões de preço doméstico e de dividendos.",
    correlationWith: ["usdnok", "usdcad", "usdbrl"], sources: ["World Bank Pink Sheet", "DFP/CVM"],
  },
  {
    driver: "soja", driverLabel: "Soja", scenario: "Alta da soja",
    explanation: "Produtores e originadores ganham receita; fabricantes de ração (via farelo) e esmagadoras dependem da margem entre grão, farelo e óleo.",
    effects: [
      { target: "SLC Agrícola", ref: "SLCE3", targetType: "company", direction: "positive", channel: "Soja é a principal cultura" },
      { target: "BrasilAgro", ref: "AGRO3", targetType: "company", direction: "positive", channel: "Produção e valorização de terras" },
      { target: "3tentos", ref: "TTEN3", targetType: "company", direction: "mixed", channel: "Originação, insumos e esmagamento" },
      { target: "Produtores de proteína animal", targetType: "industry", direction: "negative", channel: "Custo de ração" },
    ],
    counterfactors: ["Vendas antecipadas", "Custos de fertilizantes", "Prêmios de exportação e câmbio"],
    uncertainty: "média", limitations: "Preço ao produtor brasileiro (CEPEA) exige licença; usamos o benchmark internacional.",
    correlationWith: ["usdbrl", "milho", "farelo-soja"], sources: ["World Bank Pink Sheet", "DFP/CVM"],
  },
  {
    driver: "aluminio", driverLabel: "Alumínio", scenario: "Alta do alumínio",
    explanation: "Produtores integrados de alumínio primário ganham receita; transformadores, embaladores (latas) e a construção pagam mais.",
    effects: [
      { target: "CBA", ref: "CBAV3", targetType: "company", direction: "positive", channel: "Produção de alumínio primário" },
      { target: "Fabricantes de latas e embalagens", targetType: "industry", direction: "negative", channel: "Custo de metal" },
    ],
    counterfactors: ["Custo de energia", "Prêmio físico", "Câmbio"], uncertainty: "média", limitations: "Prêmio físico Brasil não integrado.",
    correlationWith: ["usdbrl"], sources: ["World Bank Pink Sheet", "DFP/CVM"],
  },
  {
    driver: "ureia", driverLabel: "Ureia (fertilizante)", scenario: "Alta dos fertilizantes nitrogenados",
    explanation: "O Brasil importa a maior parte do nitrogênio que usa; alta de preço eleva o custo por hectare de milho, cana e algodão.",
    effects: [
      { target: "Produtores agrícolas", targetType: "industry", direction: "negative", channel: "Custo de produção" },
      { target: "Revendas de insumos (ex.: 3tentos)", ref: "TTEN3", targetType: "company", direction: "mixed", channel: "Receita maior, mas risco de crédito e volume" },
    ],
    counterfactors: ["Compras antecipadas", "Relação de troca grão/fertilizante"], uncertainty: "média", limitations: "Benchmark FOB Oriente Médio; preço CFR Brasil difere.",
    correlationWith: ["brent", "gas-natural-eu"], sources: ["World Bank Pink Sheet"],
  },
  {
    driver: "ouro", driverLabel: "Ouro", scenario: "Alta do ouro",
    explanation: "ETFs e fundos de ouro acompanham o preço (em reais, também o câmbio). O ouro costuma reagir a juros reais e ao dólar globais.",
    effects: [
      { target: "ETFs de ouro (fundos de índice)", targetType: "fund_type", direction: "positive", channel: "Exposição direta ao índice de ouro" },
      { target: "Fundos multimercado com ouro", targetType: "fund_type", direction: "mixed", channel: "Depende de posição e hedge" },
    ],
    counterfactors: ["Dólar mais forte", "Juros reais em alta", "Real apreciado reduz o retorno em reais"],
    uncertainty: "média", limitations: "Posições de multimercados não são verificadas sem a carteira (CDA).",
    correlationWith: ["dxy", "usdbrl", "prata"], sources: ["World Bank Pink Sheet", "CVM (cadastro de fundos)"],
  },
];

export function linksForDriver(id: string) {
  return IMPACT_LINKS.filter((l) => l.driver === id);
}

export function linksForTicker(ticker: string) {
  return IMPACT_LINKS.flatMap((l) => l.effects.filter((e) => e.ref === ticker).map((e) => ({ link: l, effect: e })));
}
