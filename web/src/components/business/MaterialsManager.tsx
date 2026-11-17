"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { Badge, btnClass, cn, inputClass, labelClass } from "../ui";
import { Change } from "../market/bits";

export interface MaterialRow {
  id: string; name: string; unit: string; monthly_consumption: number; current_price: number; currency: string; inventory_qty: number; lead_time_days: number;
  storage_cost_pct_month: number; usd_share: number; essential: boolean; commodity_id: string | null;
  market?: { name: string; m1: number | null; y1: number | null; stale: boolean; demo: boolean } | null;
}

const blank = { name: "", commodity_id: "", unit: "t", monthly_consumption: "", current_price: "", inventory_qty: "0", lead_time_days: "15", storage_cost_pct_month: "0.5", usd_share: "0", essential: true };

export function MaterialsManager({ materials, commodities, canEdit }: { materials: MaterialRow[]; commodities: { id: string; label: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof blank & { id?: string }>(blank);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      ...(form.id ? { id: form.id } : {}), name: form.name || commodities.find((c) => c.id === form.commodity_id)?.label, commodity_id: form.commodity_id || null, unit: form.unit,
      monthly_consumption: Number(form.monthly_consumption), current_price: Number(form.current_price), inventory_qty: Number(form.inventory_qty),
      lead_time_days: Number(form.lead_time_days), storage_cost_pct_month: Number(form.storage_cost_pct_month), usd_share: Number(form.usd_share), essential: form.essential,
    };
    const r = await fetch("/api/business/materials", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) return setErr(d.issues?.[0] ? `${d.issues[0].path}: ${d.issues[0].message}` : d.error);
    setErr(null);
    setOpen(false);
    setForm(blank);
    router.refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Excluir este material?")) return;
    await fetch("/api/business/materials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  };
  const f = (k: keyof typeof blank, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className={labelClass}>{label}</label><input className={cn(inputClass, "h-8 text-xs")} value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} /></div>
  );
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[1000px] text-[12.5px]">
          <thead><tr><th className="text-left">Matéria-prima</th><th className="text-left">Mercado de referência</th><th className="text-right">Consumo/mês</th><th className="text-right">Preço atual</th><th className="text-right">Gasto mensal</th><th className="text-right">Estoque (dias)</th><th className="text-right">Parcela em US$</th><th className="text-right">Mercado 1m</th><th className="text-right">Mercado 12m</th><th /></tr></thead>
          <tbody>
            {materials.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-sm text-muted">Cadastre as matérias-primas que sua empresa compra regularmente.</td></tr>}
            {materials.map((m) => (
              <tr key={m.id}>
                <td><span className="font-medium">{m.name}</span> {m.essential && <Badge tone="gold">essencial</Badge>}</td>
                <td className="text-xs">{m.market ? <>{m.market.name} {m.market.demo && <Badge tone="purple">demo</Badge>}{m.market.stale && <Badge tone="gold">desatualizado</Badge>}</> : <span className="text-muted">não vinculado</span>}</td>
                <td className="num text-right">{fmtNumber(m.monthly_consumption, 1)} {m.unit}</td>
                <td className="num text-right">{fmtMoney(m.current_price)}/{m.unit}</td>
                <td className="num text-right font-semibold">{fmtMoney(m.monthly_consumption * m.current_price, "BRL", "pt", 0)}</td>
                <td className="num text-right">{m.monthly_consumption ? Math.round((m.inventory_qty / m.monthly_consumption) * 30) : "—"}</td>
                <td className="num text-right">{fmtNumber(m.usd_share, 0)}%</td>
                <td className="text-right">{m.market && !m.market.demo ? <Change v={m.market.m1} /> : "—"}</td>
                <td className="text-right">{m.market && !m.market.demo ? <Change v={m.market.y1} /> : "—"}</td>
                <td className="whitespace-nowrap">
                  {canEdit && <>
                    <button className="mr-2 text-muted hover:text-fg" aria-label="Editar" onClick={() => { setForm({ id: m.id, name: m.name, commodity_id: m.commodity_id ?? "", unit: m.unit, monthly_consumption: String(m.monthly_consumption), current_price: String(m.current_price), inventory_qty: String(m.inventory_qty), lead_time_days: String(m.lead_time_days), storage_cost_pct_month: String(m.storage_cost_pct_month), usd_share: String(m.usd_share), essential: m.essential }); setOpen(true); }}><Pencil size={13} /></button>
                    <button className="text-muted hover:text-red-400" aria-label="Excluir" onClick={() => del(m.id)}><Trash2 size={13} /></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="border-t border-line p-4">
          {!open ? <button className={btnClass("outline", "sm")} onClick={() => { setForm(blank); setOpen(true); }}>+ Matéria-prima</button> : (
            <form onSubmit={submit} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div><label className={labelClass}>Mercado de referência</label>
                <select className={cn(inputClass, "h-8 text-xs")} value={form.commodity_id} onChange={(e) => setForm({ ...form, commodity_id: e.target.value })}>
                  <option value="">— nenhum —</option>{commodities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              {f("name", "Nome interno")}
              {f("unit", "Unidade")}
              {f("monthly_consumption", "Consumo mensal", { inputMode: "decimal", required: true })}
              {f("current_price", "Preço atual (R$/un.)", { inputMode: "decimal", required: true })}
              {f("inventory_qty", "Estoque atual", { inputMode: "decimal" })}
              {f("lead_time_days", "Prazo de entrega (dias)", { inputMode: "numeric" })}
              {f("storage_cost_pct_month", "Armazenagem (% a.m.)", { inputMode: "decimal" })}
              {f("usd_share", "Parcela atrelada ao US$ (%)", { inputMode: "decimal" })}
              <label className="flex items-end gap-1.5 pb-2 text-xs"><input type="checkbox" checked={form.essential} onChange={(e) => setForm({ ...form, essential: e.target.checked })} /> Essencial</label>
              <div className="flex items-end gap-2"><button className={btnClass("primary", "sm")}>{form.id ? "Salvar" : "Adicionar"}</button><button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>Cancelar</button></div>
              {err && <p className="text-xs text-red-400 sm:col-span-6">{err}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
