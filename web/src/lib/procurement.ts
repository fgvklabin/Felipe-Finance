// Cálculos de compras (Avermont Business). Funções puras — cobertas por testes.
// Nenhuma função aqui "recomenda" uma decisão: elas quantificam cenários sob premissas explícitas.

export interface Quote {
  id: string; supplier_name: string; quantity: number; unit: string; unit_price: number; currency: "BRL" | "USD" | "EUR";
  freight_total: number; tax_pct: number; payment_days: number; delivery_days: number | null; min_order_qty: number | null;
  valid_until: string | null; verified_by_user: boolean; is_demo: boolean; supplier_verification?: string | null;
}

export interface FxRates { USD: number; EUR: number }

export interface CostBreakdown {
  goods: number; freight: number; taxes: number; total: number; perUnit: number; presentValue: number; pvPerUnit: number;
  fxRate: number; warnings: string[]; eligible: boolean;
}

/** Converte taxa anual (% a.a.) em taxa mensal equivalente (decimal). */
export function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/**
 * Custo total de aquisição entregue (R$) = mercadoria (convertida em R$) + frete + impostos não recuperáveis.
 * Valor presente: desconta o pagamento pelo prazo (dias) à taxa mensal informada — prazos maiores valem mais.
 */
export function deliveredCost(q: Quote, fx: FxRates, rateMonthly: number, requiredQty?: number, today = new Date()): CostBreakdown {
  const fxRate = q.currency === "BRL" ? 1 : fx[q.currency];
  const goods = q.quantity * q.unit_price * fxRate;
  const taxes = goods * (q.tax_pct / 100);
  const total = goods + q.freight_total + taxes;
  const presentValue = total / Math.pow(1 + rateMonthly, q.payment_days / 30);
  const warnings: string[] = [];
  if (q.is_demo) warnings.push("Cotação de demonstração (fictícia)");
  if (!q.verified_by_user) warnings.push("Valores ainda não verificados por você");
  if (q.valid_until && new Date(`${q.valid_until}T23:59:59`) < today) warnings.push("Cotação vencida");
  if (q.min_order_qty && requiredQty !== undefined && requiredQty < q.min_order_qty) warnings.push(`Volume necessário abaixo do pedido mínimo (${q.min_order_qty} ${q.unit})`);
  if (q.currency !== "BRL") warnings.push(`Preço em ${q.currency}: exposição cambial até o pagamento`);
  const eligible = q.verified_by_user && !q.is_demo && !(q.valid_until && new Date(`${q.valid_until}T23:59:59`) < today);
  return { goods, freight: q.freight_total, taxes, total, perUnit: total / q.quantity, presentValue, pvPerUnit: presentValue / q.quantity, fxRate, warnings, eligible };
}

/** Ranking por custo por unidade (total entregue ou valor presente). Cotações inelegíveis vão para o fim. */
export function rankQuotes<T extends Quote>(quotes: T[], fx: FxRates, rateMonthly: number, by: "total" | "pv" = "total", requiredQty?: number) {
  return quotes
    .map((q) => ({ quote: q, cost: deliveredCost(q, fx, rateMonthly, requiredQty) }))
    .sort((a, b) => {
      if (a.cost.eligible !== b.cost.eligible) return a.cost.eligible ? -1 : 1;
      return by === "pv" ? a.cost.pvPerUnit - b.cost.pvPerUnit : a.cost.perUnit - b.cost.perUnit;
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

/** Diferença financeira entre duas propostas para um mesmo volume. */
export function compareProposals(a: CostBreakdown, b: CostBreakdown, volume: number) {
  const diffPerUnit = b.perUnit - a.perUnit;
  const diffPvPerUnit = b.pvPerUnit - a.pvPerUnit;
  return {
    diffPerUnit, diffTotal: diffPerUnit * volume, diffPct: a.perUnit ? b.perUnit / a.perUnit - 1 : 0,
    diffPvPerUnit, diffPvTotal: diffPvPerUnit * volume, cheaper: diffPerUnit > 0 ? "A" : diffPerUnit < 0 ? "B" : "igual",
  };
}

export interface Material {
  id: string; name: string; unit: string; monthly_consumption: number; current_price: number; inventory_qty: number;
  lead_time_days: number; storage_cost_pct_month: number; usd_share: number; essential: boolean; commodity_id: string | null;
}

/** Impacto de uma variação de preço no gasto mensal, supondo consumo constante e condições comerciais equivalentes. */
export function priceImpact(m: Material, change: number, passThrough = 1) {
  const monthlySpend = m.monthly_consumption * m.current_price;
  const delta = monthlySpend * change * passThrough;
  return { monthlySpend, delta, annualDelta: delta * 12, newMonthlySpend: monthlySpend + delta };
}

/** Impacto de um choque cambial na parcela do custo atrelada ao dólar. */
export function fxImpact(m: Material, fxShock: number) {
  const monthlySpend = m.monthly_consumption * m.current_price;
  const exposed = monthlySpend * (m.usd_share / 100);
  return { exposed, delta: exposed * fxShock };
}

export function coverageDays(m: Material) {
  return m.monthly_consumption > 0 ? (m.inventory_qty / m.monthly_consumption) * 30 : Infinity;
}

export interface ScenarioInput {
  horizonMonths: number;
  changeCentral: number; changeLow: number; changeHigh: number; // variação acumulada esperada no horizonte
  rateMonthly: number; fixedPremiumPct: number; delayMonths: number; altSupplierPrice: number | null; passThrough: number;
  storageOverride?: number; // custo de armazenagem mensal (decimal) — sobrescreve o do material
}

export interface Scenario {
  id: "immediate" | "gradual" | "delay" | "fixed" | "alternative";
  label: string; feasible: boolean; expected: number | null; low: number | null; high: number | null;
  pros: string[]; cons: string[]; warnings: string[];
}

/** Compara estratégias de compra para cobrir o consumo do horizonte. Custos em R$ (valor nominal). */
export function purchaseScenarios(m: Material, s: ScenarioInput): Scenario[] {
  const H = Math.max(1, Math.round(s.horizonMonths));
  const c = m.monthly_consumption;
  const p0 = m.current_price;
  const Q = c * H;
  const priceAt = (month: number, change: number) => p0 * (1 + change * s.passThrough * (month / H));
  const cover = coverageDays(m);

  // Compra imediata: preço travado; custo de armazenagem e de capital do estoque antecipado
  let storage = 0, capital = 0;
  for (let k = 1; k <= H; k++) {
    storage += c * p0 * (s.storageOverride ?? m.storage_cost_pct_month / 100) * (k - 1);
    capital += c * p0 * (Math.pow(1 + s.rateMonthly, k - 1) - 1);
  }
  const immediate = Q * p0 + storage + capital;

  const gradual = (chg: number) => {
    let t = 0;
    for (let k = 1; k <= H; k++) t += c * priceAt(k, chg);
    return t;
  };

  const D = Math.max(1, Math.round(s.delayMonths));
  const needDays = m.lead_time_days + 30 * D;
  const delayFeasible = cover >= needDays;
  const delay = (chg: number) => Q * priceAt(Math.min(D, H), chg);

  const fixed = Q * p0 * (1 + s.fixedPremiumPct / 100);

  const essentialWarning = m.essential ? "Material essencial: não adie compras necessárias com base apenas em previsão de preço." : null;

  const out: Scenario[] = [
    {
      id: "immediate", label: "Comprar tudo agora", feasible: true, expected: immediate, low: immediate, high: immediate,
      pros: ["Elimina o risco de alta de preço no horizonte", "Garante disponibilidade"],
      cons: [`Armazenagem estimada R$ ${Math.round(storage).toLocaleString("pt-BR")}`, `Custo de capital estimado R$ ${Math.round(capital).toLocaleString("pt-BR")}`, "Abre mão de eventual queda de preço", "Exige caixa e espaço físico"],
      warnings: [],
    },
    {
      id: "gradual", label: "Comprar gradualmente (mensal)", feasible: true, expected: gradual(s.changeCentral), low: gradual(s.changeLow), high: gradual(s.changeHigh),
      pros: ["Dilui o risco de preço (preço médio)", "Menor necessidade de capital de giro e armazenagem"],
      cons: ["Exposto a altas ao longo do horizonte", "Mais negociações e fretes"],
      warnings: [],
    },
    {
      id: "delay", label: `Adiar a compra ${D} ${D === 1 ? "mês" : "meses"}`, feasible: delayFeasible,
      expected: delayFeasible ? delay(s.changeCentral) : null, low: delayFeasible ? delay(s.changeLow) : null, high: delayFeasible ? delay(s.changeHigh) : null,
      pros: ["Pode capturar queda de preço, se ocorrer", "Preserva caixa no curto prazo"],
      cons: ["Risco de alta e de ruptura de abastecimento", "Depende de estoque e prazo de entrega"],
      warnings: [
        ...(delayFeasible ? [] : [`Estoque cobre ~${Number.isFinite(cover) ? Math.round(cover) : "∞"} dias, menos que prazo de entrega + adiamento (${needDays} dias): risco de ruptura.`]),
        ...(essentialWarning ? [essentialWarning] : []),
      ],
    },
    {
      id: "fixed", label: `Contrato a preço fixo (+${s.fixedPremiumPct}% de prêmio)`, feasible: true, expected: fixed, low: fixed, high: fixed,
      pros: ["Previsibilidade de custo", "Sem armazenagem antecipada (entregas programadas)"],
      cons: ["Prêmio pago ao fornecedor", "Não captura quedas de preço", "Risco de contraparte (cumprimento do contrato)"],
      warnings: ["O prêmio é uma premissa sua: confirme com fornecedores."],
    },
    {
      id: "alternative", label: "Fornecedor alternativo", feasible: s.altSupplierPrice !== null,
      expected: s.altSupplierPrice !== null ? Q * s.altSupplierPrice : null, low: s.altSupplierPrice !== null ? Q * s.altSupplierPrice : null, high: s.altSupplierPrice !== null ? Q * s.altSupplierPrice : null,
      pros: ["Usa a melhor cotação verificada do comparador (custo total entregue)"],
      cons: ["Qualidade, confiabilidade e prazo precisam ser validados", "Custo de homologação de novo fornecedor"],
      warnings: s.altSupplierPrice === null ? ["Sem cotação alternativa verificada e válida para este material."] : [],
    },
  ];
  return out;
}
