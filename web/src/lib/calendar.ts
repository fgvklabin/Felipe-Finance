// Calendário de publicações recorrentes das fontes integradas.
// Datas "estimadas" seguem a regra de publicação usual da fonte e devem ser confirmadas no calendário oficial.

export interface CalEvent { id: string; date: string; time?: string; title: string; category: string; source: string; url?: string; confirmed: boolean; rule: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);

function isBusinessDay(d: Date) {
  const w = d.getUTCDay();
  return w !== 0 && w !== 6;
}

function nthBusinessDay(year: number, month: number, n: number) {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (true) {
    if (isBusinessDay(d)) count++;
    if (count === n) return new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

export function generateEvents(from: Date, days: number): CalEvent[] {
  const out: CalEvent[] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(start.getTime() + days * 86400000);
  // Diários / semanais
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (!isBusinessDay(d)) continue;
    const ds = iso(d);
    if (d.getUTCDay() === 1) {
      out.push({ id: `focus-${ds}`, date: ds, time: "08:25", title: "Boletim Focus — expectativas de mercado", category: "macro", source: "Banco Central do Brasil", url: "https://www.bcb.gov.br/publicacoes/focus", confirmed: false, rule: "Publicado às segundas-feiras (dias úteis)" });
    }
    out.push({ id: `ptax-${ds}`, date: ds, time: "13:00", title: "PTAX de fechamento", category: "moedas", source: "Banco Central do Brasil", confirmed: false, rule: "Dias úteis no Brasil (feriados nacionais não considerados)" });
  }
  // Mensais
  for (let m = 0; m < Math.ceil(days / 28) + 2; m++) {
    const y = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + m) / 12);
    const mo = (start.getUTCMonth() + m) % 12;
    const pink = nthBusinessDay(y, mo, 2);
    out.push({ id: `pink-${iso(pink)}`, date: iso(pink), title: "World Bank Pink Sheet — preços mensais de commodities", category: "commodities", source: "World Bank", url: "https://www.worldbank.org/en/research/commodity-markets", confirmed: false, rule: "Geralmente no início de cada mês (2º dia útil)" });
    const ipca = new Date(Date.UTC(y, mo, 10));
    while (!isBusinessDay(ipca)) ipca.setUTCDate(ipca.getUTCDate() + 1);
    out.push({ id: `ipca-${iso(ipca)}`, date: iso(ipca), time: "09:00", title: "IPCA — inflação oficial (mês anterior)", category: "macro", source: "IBGE", url: "https://www.ibge.gov.br/explica/inflacao.php", confirmed: false, rule: "Por volta do dia 10; confirme no calendário do IBGE" });
    const ibc = new Date(Date.UTC(y, mo, 15));
    while (!isBusinessDay(ibc)) ibc.setUTCDate(ibc.getUTCDate() + 1);
    out.push({ id: `ibc-${iso(ibc)}`, date: iso(ibc), title: "IBC-Br — atividade econômica", category: "macro", source: "Banco Central do Brasil", confirmed: false, rule: "Meados do mês; confirme no BCB" });
  }
  return out.filter((e) => e.date >= iso(start) && e.date < iso(end)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Próximos eventos relevantes (exclui a PTAX diária, exceto a do próximo dia útil). */
export function upcomingEvents(n: number, now = new Date()): CalEvent[] {
  const ev = generateEvents(now, 45);
  const firstPtax = ev.find((e) => e.id.startsWith("ptax-"));
  return [...(firstPtax ? [firstPtax] : []), ...ev.filter((e) => !e.id.startsWith("ptax-"))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
}
