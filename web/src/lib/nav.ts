import type { DictKey } from "./i18n";

export interface NavItem { key: DictKey; href: string; icon: string; color?: string; requiresAuth?: boolean }
export interface NavGroup { key: DictKey; items: NavItem[] }

// Estrutura de navegação principal (ordem do briefing do produto).
export const NAV: NavGroup[] = [
  {
    key: "group.markets",
    items: [
      { key: "nav.overview", href: "/visao-geral", icon: "LayoutDashboard" },
      { key: "nav.markets", href: "/mercados", icon: "CandlestickChart" },
      { key: "nav.agri", href: "/mercados/agricolas", icon: "Wheat", color: "#84CC16" },
      { key: "nav.metals", href: "/mercados/metais", icon: "Pickaxe", color: "#3B82F6" },
      { key: "nav.polymers", href: "/mercados/polimeros", icon: "Hexagon", color: "#8B5CF6" },
      { key: "nav.chemicals", href: "/mercados/quimicos", icon: "FlaskConical", color: "#06B6D4" },
      { key: "nav.pulp", href: "/mercados/papel-celulose", icon: "Trees", color: "#F472B6" },
      { key: "nav.energy", href: "/mercados/energia", icon: "Flame", color: "#F97316" },
      { key: "nav.fx", href: "/moedas", icon: "Coins", color: "#38BDF8" },
    ],
  },
  {
    key: "group.intelligence",
    items: [
      { key: "nav.forecasts", href: "/previsoes", icon: "TrendingUp" },
      { key: "nav.futures", href: "/curvas-futuras", icon: "Spline" },
      { key: "nav.impact", href: "/impacto", icon: "Network" },
      { key: "nav.news", href: "/noticias", icon: "Newspaper" },
      { key: "nav.ai", href: "/ai", icon: "Sparkles" },
      { key: "nav.calendar", href: "/calendario", icon: "CalendarDays" },
    ],
  },
  {
    key: "group.business",
    items: [
      { key: "nav.business", href: "/business", icon: "Building2", requiresAuth: true },
      { key: "nav.suppliers", href: "/business/fornecedores", icon: "Scale", requiresAuth: true },
    ],
  },
  {
    key: "group.tools",
    items: [
      { key: "nav.beneficiaries", href: "/beneficiarios", icon: "Landmark" },
      { key: "nav.portfolio", href: "/carteira", icon: "Briefcase", requiresAuth: true },
      { key: "nav.simulator", href: "/simulador", icon: "FlaskRound" },
    ],
  },
  {
    key: "group.personal",
    items: [
      { key: "nav.watchlist", href: "/watchlist", icon: "Star", requiresAuth: true },
      { key: "nav.alerts", href: "/alertas", icon: "Bell", requiresAuth: true },
      { key: "nav.sources", href: "/fontes", icon: "Database" },
      { key: "nav.settings", href: "/configuracoes", icon: "Settings", requiresAuth: true },
    ],
  },
];

export const CATEGORY_ROUTES: Record<string, string[]> = {
  agricolas: ["agricolas"],
  metais: ["metais", "metais-preciosos"],
  polimeros: ["polimeros"],
  quimicos: ["quimicos"],
  "papel-celulose": ["papel-celulose"],
  energia: ["energia"],
};
