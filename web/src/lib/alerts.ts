// Avaliação de alertas — função pura sobre um "snapshot" de mercado (testável sem banco).

export type AlertType = "price_above" | "price_below" | "pct_change_up" | "pct_change_down" | "fx_move" | "forecast_change" | "curve_change" | "new_quote" | "news" | "company_results" | "fund_exposure";

export interface AlertRow { id: string; alert_type: AlertType; item_type: string; item_ref: string; threshold: number | null; last_state: Record<string, unknown> | null }

export interface MarketView {
  price(ref: string): { value: number; date: string; d1: number | null; m1: number | null; frequency: string; name: string } | null;
  forecastDirection(ref: string): { direction: string; status: string; central: number | null } | null;
  latestPeriod(ticker: string): string | null; // "2026T3" (trimestre) ou "2025" (ano)
  fundExposure(cnpj: string): string | null;
  latestNoteDate(ref: string): { date: string; title: string } | null;
}

export interface AlertResult { triggered: boolean; title: string; body: string; state: Record<string, unknown>; value: number | null; unavailable?: string }

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(2).replace(".", ",")}%`;

export function evaluateAlert(a: AlertRow, m: MarketView): AlertResult {
  const prev = a.last_state ?? {};
  const none = (state: Record<string, unknown>, value: number | null = null): AlertResult => ({ triggered: false, title: "", body: "", state, value });
  switch (a.alert_type) {
    case "price_above":
    case "price_below": {
      const p = m.price(a.item_ref);
      if (!p || a.threshold === null) return { ...none(prev), unavailable: "sem preço" };
      const cond = a.alert_type === "price_above" ? p.value >= a.threshold : p.value <= a.threshold;
      const fired = cond && prev.active !== true; // dispara ao cruzar; rearma quando a condição deixa de valer
      return {
        triggered: fired, value: p.value, state: { active: cond, date: p.date },
        title: `${p.name} ${a.alert_type === "price_above" ? "acima" : "abaixo"} de ${a.threshold}`,
        body: `Preço ${p.value.toLocaleString("pt-BR")} em ${p.date} (seu alvo: ${a.threshold.toLocaleString("pt-BR")}).`,
      };
    }
    case "pct_change_up":
    case "pct_change_down":
    case "fx_move": {
      const p = m.price(a.item_ref);
      if (!p || a.threshold === null) return { ...none(prev), unavailable: "sem preço" };
      const chg = p.frequency === "daily" ? p.d1 : p.m1;
      if (chg === null) return none(prev);
      const t = Math.abs(a.threshold) / 100;
      const cond = a.alert_type === "pct_change_up" ? chg >= t : a.alert_type === "pct_change_down" ? chg <= -t : Math.abs(chg) >= t;
      const fired = cond && prev.date !== p.date; // no máximo um disparo por observação
      return {
        triggered: fired, value: chg, state: { date: cond ? p.date : prev.date ?? null },
        title: `${p.name}: variação de ${pct(chg)}`,
        body: `${p.frequency === "daily" ? "No último dia" : "No último mês publicado"} (${p.date}) a variação foi ${pct(chg)}; seu limite: ${a.threshold}%.`,
      };
    }
    case "forecast_change": {
      const f = m.forecastDirection(a.item_ref);
      if (!f) return { ...none(prev), unavailable: "sem previsão" };
      const key = `${f.status}:${f.direction}`;
      const fired = prev.key !== undefined && prev.key !== key;
      return { triggered: fired, value: f.central, state: { key }, title: "A previsão mudou", body: `A previsão de 30 dias passou de “${prev.key ?? "—"}” para “${key}”.` };
    }
    case "company_results": {
      const p = m.latestPeriod(a.item_ref);
      if (p === null) return { ...none(prev), unavailable: "sem dados" };
      // estado antigo guardava só o ano: apenas atualiza, sem disparar
      const fired = typeof prev.period === "string" && p > prev.period;
      const label = p.includes("T") ? `${p.slice(-1)}º trimestre de ${p.slice(0, 4)}` : p;
      return { triggered: fired, value: null, state: { period: p }, title: `${a.item_ref}: novo resultado divulgado`, body: `Resultado do ${label} disponível (CVM).` };
    }
    case "fund_exposure": {
      const e = m.fundExposure(a.item_ref);
      if (e === null) return { ...none(prev), unavailable: "fundo não encontrado" };
      const fired = typeof prev.exposure === "string" && prev.exposure !== e;
      return { triggered: fired, value: null, state: { exposure: e }, title: "Mudança na exposição do fundo", body: `Classificação de exposição mudou de “${prev.exposure}” para “${e}”.` };
    }
    case "news": {
      const n = m.latestNoteDate(a.item_ref);
      if (!n) return none(prev);
      const fired = typeof prev.date === "string" ? n.date > prev.date : false;
      return { triggered: fired, value: null, state: { date: n.date }, title: "Nova nota de mercado", body: n.title };
    }
    case "curve_change":
      return { ...none(prev), unavailable: "curvas futuras de bolsa exigem licença e não estão integradas" };
    case "new_quote":
      return none(prev); // disparado no momento em que a cotação é registrada
  }
}
