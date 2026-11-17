import type { Locale } from "./format";

// Dicionário da interface. Conteúdo analítico permanece em português (idioma padrão);
// a navegação e os rótulos principais estão disponíveis em inglês.
const dict = {
  "nav.overview": { pt: "Visão Geral", en: "Overview" },
  "nav.markets": { pt: "Mercados", en: "Markets" },
  "nav.agri": { pt: "Commodities Agrícolas", en: "Agricultural" },
  "nav.metals": { pt: "Metais", en: "Metals" },
  "nav.polymers": { pt: "Polímeros", en: "Polymers" },
  "nav.chemicals": { pt: "Químicos", en: "Chemicals" },
  "nav.pulp": { pt: "Papel e Celulose", en: "Pulp & Paper" },
  "nav.energy": { pt: "Energia", en: "Energy" },
  "nav.fx": { pt: "Moedas", en: "Currencies" },
  "nav.forecasts": { pt: "Previsões", en: "Forecasts" },
  "nav.futures": { pt: "Curvas Futuras", en: "Futures Curves" },
  "nav.business": { pt: "Avermont Business", en: "Avermont Business" },
  "nav.suppliers": { pt: "Comparador de Fornecedores", en: "Supplier Comparison" },
  "nav.invest": { pt: "Avermont Invest", en: "Avermont Invest" },
  "nav.companies": { pt: "Empresas e Ações", en: "Companies & Stocks" },
  "nav.funds": { pt: "Fundos de Investimento", en: "Investment Funds" },
  "nav.etfs": { pt: "ETFs", en: "ETFs" },
  "nav.news": { pt: "Notícias", en: "News" },
  "nav.ai": { pt: "Avermont AI", en: "Avermont AI" },
  "nav.watchlist": { pt: "Watchlist", en: "Watchlist" },
  "nav.alerts": { pt: "Alertas", en: "Alerts" },
  "nav.calendar": { pt: "Calendário Econômico", en: "Economic Calendar" },
  "nav.settings": { pt: "Configurações", en: "Settings" },
  "nav.impact": { pt: "Impact Engine", en: "Impact Engine" },
  "nav.sources": { pt: "Fontes de Dados", en: "Data Sources" },
  "nav.admin": { pt: "Administração", en: "Admin" },
  "nav.supplierPortal": { pt: "Portal do Fornecedor", en: "Supplier Portal" },
  "group.markets": { pt: "Mercados", en: "Markets" },
  "group.intelligence": { pt: "Inteligência", en: "Intelligence" },
  "group.business": { pt: "B2B", en: "B2B" },
  "group.invest": { pt: "B2C", en: "B2C" },
  "group.personal": { pt: "Pessoal", en: "Personal" },
  "search.placeholder": { pt: "Buscar commodities, empresas, fundos, moedas…", en: "Search commodities, companies, funds, FX…" },
  "auth.login": { pt: "Entrar", en: "Sign in" },
  "auth.register": { pt: "Criar conta", en: "Sign up" },
  "auth.logout": { pt: "Sair", en: "Sign out" },
  "common.price": { pt: "Preço", en: "Price" },
  "common.unit": { pt: "Unidade", en: "Unit" },
  "common.source": { pt: "Fonte", en: "Source" },
  "common.updated": { pt: "Atualizado", en: "Updated" },
  "common.forecast": { pt: "Previsão", en: "Forecast" },
  "common.day": { pt: "Dia", en: "Day" },
  "common.week": { pt: "Semana", en: "Week" },
  "common.month": { pt: "Mês", en: "Month" },
  "common.year": { pt: "12 meses", en: "12 months" },
  "common.ytd": { pt: "No ano", en: "YTD" },
  "common.name": { pt: "Nome", en: "Name" },
  "mode.all": { pt: "Real + Demonstração", en: "Real + Demo" },
  "mode.real": { pt: "Somente dados reais", en: "Real data only" },
  "disclaimer.short": {
    pt: "Conteúdo educacional e analítico. Não é recomendação de investimento. Previsões são estimativas estatísticas sem garantia.",
    en: "Educational and analytical content. Not investment advice. Forecasts are statistical estimates with no guarantee.",
  },
} as const;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, l: Locale = "pt"): string {
  return dict[key][l] ?? dict[key].pt;
}
