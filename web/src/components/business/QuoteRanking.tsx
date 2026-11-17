"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Calculator, Trash2 } from "lucide-react";
import { compareProposals, rankQuotes, type FxRates, type Quote } from "@/lib/procurement";
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import { Badge, btnClass, cn, inputClass, labelClass } from "../ui";

export interface QuoteRow extends Quote {
  product: string; specification: string | null; quality: string | null; delivery_location: string | null; contact: string | null;
  commodity_id: string | null; source: string; supplier_id: string | null; created_at: string;
}

export function QuoteRanking({ quotes, fx, rateMonthly, selicLabel, commodities, canEdit }: { quotes: QuoteRow[]; fx: FxRates; rateMonthly: number; selicLabel: string; commodities: { id: string; label: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ commodity: "", text: "", quality: "", volume: "", location: "", deadline: "", minPayment: "", budget: "", onlyEligible: false });
  const [by, setBy] = useState<"total" | "pv">("total");
  const [pick, setPick] = useState<string[]>([]);

  const volume = Number(f.volume.replace(",", ".")) || undefined;
  const filtered = useMemo(() => {
    const t = f.text.trim().toLowerCase();
    return quotes.filter((q) =>
      (!f.commodity || q.commodity_id === f.commodity) &&
      (!t || `${q.product} ${q.specification ?? ""} ${q.supplier_name}`.toLowerCase().includes(t)) &&
      (!f.quality || (q.quality ?? q.specification ?? "").toLowerCase().includes(f.quality.toLowerCase())) &&
      (!f.location || (q.delivery_location ?? "").toLowerCase().includes(f.location.toLowerCase())) &&
      (!f.deadline || (q.delivery_days !== null && q.delivery_days <= Number(f.deadline))) &&
      (!f.minPayment || q.payment_days >= Number(f.minPayment)));
  }, [quotes, f]);
  const ranked = useMemo(() => {
    const r = rankQuotes(filtered, fx, rateMonthly, by, volume);
    const budget = Number(f.budget.replace(",", ".")) || null;
    return r.filter((x) => (!f.onlyEligible || x.cost.eligible) && (!budget || !volume || x.cost.perUnit * volume <= budget));
  }, [filtered, fx, rateMonthly, by, volume, f.budget, f.onlyEligible]);

  const A = ranked.find((x) => x.quote.id === pick[0]);
  const B = ranked.find((x) => x.quote.id === pick[1]);
  const cmp = A && B ? compareProposals(A.cost, B.cost, volume ?? A.quote.quantity) : null;
  const best = ranked.find((x) => x.cost.eligible);

  const del = async (id: string) => {
    if (!confirm("Excluir esta cotação?")) return;
    await fetch("/api/business/quotes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  };

  const input = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className={labelClass}>{label}</label><input className={cn(inputClass, "h-8 text-xs")} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></div>
  );

  return (
    <div>
      <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        <div><label className={labelClass}>Commodity</label>
          <select className={cn(inputClass, "h-8 text-xs")} value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })}>
            <option value="">Todas</option>{commodities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        {input("text", "Produto / especificação")}
        {input("quality", "Qualidade")}
        {input("volume", "Volume necessário", { inputMode: "decimal" })}
        {input("location", "Local de entrega")}
        {input("deadline", "Prazo máx. (dias)", { inputMode: "numeric" })}
        {input("minPayment", "Prazo pgto. mín. (dias)", { inputMode: "numeric" })}
        {input("budget", "Orçamento (R$)", { inputMode: "decimal" })}
        <div className="flex flex-col justify-end gap-1 text-xs">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.onlyEligible} onChange={(e) => setF({ ...f, onlyEligible: e.target.checked })} /> Só elegíveis</label>
          <div className="flex gap-1">
            <button className={cn("rounded-md border px-2 py-0.5", by === "total" ? "border-blue text-fg" : "border-line text-muted")} onClick={() => setBy("total")}>Custo total</button>
            <button className={cn("rounded-md border px-2 py-0.5", by === "pv" ? "border-blue text-fg" : "border-line text-muted")} onClick={() => setBy("pv")} title={`Valor presente com ${selicLabel}`}>Valor presente</button>
          </div>
        </div>
      </div>
      {best && volume && (
        <div className="border-b border-line bg-emerald-500/5 px-4 py-2 text-xs text-fg-2">
          Melhor proposta elegível para {fmtNumber(volume, 0)} {best.quote.unit}: <b>{best.quote.supplier_name}</b> — {fmtMoney(best.cost.perUnit * volume)} entregue ({fmtMoney(best.cost.perUnit)}/{best.quote.unit}).
          A ordenação usa custo total de aquisição, não o preço de tabela.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[1400px] text-[12.5px]">
          <thead>
            <tr>
              <th>Comparar</th><th className="text-right">#</th><th className="text-left">Fornecedor</th><th className="text-left">Produto</th><th className="text-right">Preço un.</th>
              <th className="text-right">Frete</th><th className="text-right">Impostos</th><th className="text-right">Custo total entregue</th><th className="text-right">Custo/un.</th>
              <th className="text-right">Valor presente/un.</th><th className="text-right">Mínimo</th><th className="text-left">Qualidade</th><th className="text-left">Local</th>
              <th className="text-right">Entrega</th><th className="text-right">Pgto.</th><th>Validade</th><th>Verificação</th><th className="text-left">Contato</th><th />
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && <tr><td colSpan={19} className="py-6 text-center text-sm text-muted">Nenhuma cotação com os filtros atuais. Adicione cotações abaixo.</td></tr>}
            {ranked.map(({ quote: q, cost, rank }) => (
              <tr key={q.id} className={cn(!cost.eligible && "opacity-60")}>
                <td className="text-center"><input type="checkbox" checked={pick.includes(q.id)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, q.id].slice(-2) : p.filter((x) => x !== q.id)))} aria-label="Selecionar para comparar" /></td>
                <td className="num text-right">{cost.eligible ? rank : "—"}</td>
                <td className="max-w-[180px]">
                  <div className="truncate font-medium">{q.supplier_name}</div>
                  <div className="flex gap-1">{q.is_demo && <Badge tone="purple">demo</Badge>}<Badge tone="neutral">{q.source}</Badge></div>
                </td>
                <td className="max-w-[180px]"><div className="truncate">{q.product}</div><div className="truncate text-[10.5px] text-muted">{q.specification}</div></td>
                <td className="num text-right">{fmtNumber(q.unit_price, 2)} {q.currency !== "BRL" && <span className="text-[10px] text-gold">{q.currency}</span>}</td>
                <td className="num text-right">{fmtMoney(cost.freight, "BRL", "pt", 0)}</td>
                <td className="num text-right">{fmtMoney(cost.taxes, "BRL", "pt", 0)}<div className="text-[10px] text-muted">{fmtNumber(q.tax_pct, 1)}%</div></td>
                <td className="num text-right font-semibold">{fmtMoney(cost.total, "BRL", "pt", 0)}<div className="text-[10px] font-normal text-muted">{fmtNumber(q.quantity, 0)} {q.unit}</div></td>
                <td className="num text-right font-semibold">{fmtMoney(cost.perUnit)}</td>
                <td className="num text-right">{fmtMoney(cost.pvPerUnit)}</td>
                <td className="num text-right">{q.min_order_qty ? fmtNumber(q.min_order_qty, 0) : "—"}</td>
                <td className="max-w-[120px] truncate text-xs">{q.quality ?? "—"}</td>
                <td className="max-w-[120px] truncate text-xs">{q.delivery_location ?? "—"}</td>
                <td className="num text-right">{q.delivery_days ?? "—"}{q.delivery_days !== null && "d"}</td>
                <td className="num text-right">{q.payment_days}d</td>
                <td className="num text-xs">{q.valid_until ? fmtDate(q.valid_until) : "—"}</td>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <Badge tone={q.verified_by_user ? "green" : "gold"}>{q.verified_by_user ? "valores verificados" : "não verificado"}</Badge>
                    {!q.verified_by_user && canEdit && <button className="text-left text-[10.5px] text-blue underline" onClick={async () => { await fetch("/api/business/quotes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id, verified: true }) }); router.refresh(); }}>Confirmar valores</button>}
                    <Badge tone={q.supplier_verification === "verified" ? "green" : "neutral"}>{q.supplier_verification === "verified" ? "fornecedor verificado" : q.is_demo ? "fictício" : "fornecedor não verificado"}</Badge>
                    {cost.warnings.filter((w) => !w.includes("não verificados")).map((w) => <span key={w} className="text-[10px] text-gold">{w}</span>)}
                  </div>
                </td>
                <td className="max-w-[140px] truncate text-xs">{q.contact ?? "—"}</td>
                <td>{canEdit && !q.is_demo && <button onClick={() => del(q.id)} className="text-muted hover:text-red-400" aria-label="Excluir"><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Calculator size={15} className="text-blue" /> Calculadora de diferença entre propostas</div>
        {cmp && A && B ? (
          <div className="grid gap-3 text-[12.5px] md:grid-cols-4">
            <div className="rounded-lg border border-line p-3"><div className="text-muted">A</div><div className="font-medium">{A.quote.supplier_name}</div><div className="num">{fmtMoney(A.cost.perUnit)}/{A.quote.unit}</div></div>
            <div className="rounded-lg border border-line p-3"><div className="text-muted">B</div><div className="font-medium">{B.quote.supplier_name}</div><div className="num">{fmtMoney(B.cost.perUnit)}/{B.quote.unit}</div></div>
            <div className="rounded-lg border border-line p-3"><div className="text-muted">Diferença (B − A) para {fmtNumber(volume ?? A.quote.quantity, 0)} {A.quote.unit}</div><div className={cn("num text-lg font-semibold", cmp.diffTotal > 0 ? "text-down" : "text-up")}>{fmtMoney(cmp.diffTotal)}</div><div className="num text-muted">{fmtPct(cmp.diffPct)} por unidade</div></div>
            <div className="rounded-lg border border-line p-3"><div className="text-muted">Em valor presente ({selicLabel})</div><div className="num text-lg font-semibold">{fmtMoney(cmp.diffPvTotal)}</div><div className="text-muted">Mais barata: {cmp.cheaper === "igual" ? "empate" : cmp.cheaper === "A" ? A.quote.supplier_name : B.quote.supplier_name}</div></div>
          </div>
        ) : <p className="text-xs text-muted">Marque duas cotações na coluna “Comparar”. Informe o volume necessário nos filtros para calcular o valor total.</p>}
        <p className="mt-2 text-[11px] text-muted">Câmbio: PTAX mais recente (US$ {fmtNumber(fx.USD, 4)}, € {fmtNumber(fx.EUR, 4)}). Impostos = percentual não recuperável informado por você. Diferenças são estimativas sob as condições informadas, não economias garantidas.</p>
      </div>
    </div>
  );
}
