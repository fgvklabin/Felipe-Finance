"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { btnClass, cn, inputClass, labelClass } from "../ui";

interface Purchase { id: string; material_id: string | null; purchased_at: string; quantity: number; unit_price: number; currency: string; supplier_name: string | null }

export function PurchaseHistory({ purchases, materials, benchmarks, canEdit }: { purchases: Purchase[]; materials: { id: string; name: string; unit: string }[]; benchmarks: Record<string, { label: string; points: [string, number][] }>; canEdit: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState(materials[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const mine = purchases.filter((p) => p.material_id === sel).sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
  const bench = benchmarks[sel];
  const months = [...new Set([...mine.map((p) => String(p.purchased_at).slice(0, 7)), ...(bench?.points ?? []).slice(-24).map(([d]) => d.slice(0, 7))])].sort();
  const data = months.map((m) => ({
    m,
    compra: mine.filter((p) => String(p.purchased_at).startsWith(m)).map((p) => p.unit_price)[0] ?? null,
    bench: bench?.points.find(([d]) => d.startsWith(m))?.[1] ?? null,
  }));
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <select className={cn(inputClass, "h-8 w-60 text-xs")} value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Material">{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <span className="text-[11px] text-muted">{bench ? `Benchmark: ${bench.label} em R$ (preço internacional × PTAX; não é preço físico)` : "Sem benchmark vinculado"}</span>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="m" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis yAxisId="a" tick={{ fill: "var(--muted)", fontSize: 11 }} domain={["auto", "auto"]} />
              <YAxis yAxisId="b" orientation="right" tick={{ fill: "var(--muted)", fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="a" dataKey="compra" name="Seu preço de compra (R$/un.)" stroke="#F59E0B" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              {bench && <Line yAxisId="b" dataKey="bench" name="Benchmark (R$, eixo direito)" stroke="#3B82F6" strokeWidth={1.5} dot={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="fin-table mt-2 w-full text-[12.5px]">
          <thead><tr><th className="text-left">Data</th><th className="text-left">Material</th><th className="text-right">Qtd</th><th className="text-right">Preço</th><th className="text-right">Total</th><th className="text-left">Fornecedor</th><th /></tr></thead>
          <tbody>
            {purchases.slice(0, 12).map((p) => (
              <tr key={p.id}>
                <td className="num">{fmtDate(String(p.purchased_at).slice(0, 10))}</td>
                <td>{materials.find((m) => m.id === p.material_id)?.name ?? "—"}</td>
                <td className="num text-right">{fmtNumber(p.quantity, 1)}</td>
                <td className="num text-right">{fmtNumber(p.unit_price, 2)} {p.currency}</td>
                <td className="num text-right">{fmtMoney(p.quantity * p.unit_price, p.currency, "pt", 0)}</td>
                <td>{p.supplier_name ?? "—"}</td>
                <td>{canEdit && <button className="text-muted hover:text-red-400" aria-label="Excluir" onClick={async () => { await fetch("/api/business/purchases", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }); router.refresh(); }}><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <form
          className="space-y-2 text-xs"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(e.currentTarget));
            const r = await fetch("/api/business/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fd, material_id: fd.material_id || null }) });
            const d = await r.json();
            if (!r.ok) return setErr(d.issues?.[0]?.message ?? d.error);
            setErr(null);
            (e.target as HTMLFormElement).reset();
            router.refresh();
          }}
        >
          <div className="text-sm font-semibold">Registrar compra</div>
          <div><label className={labelClass}>Material</label><select name="material_id" className={inputClass} defaultValue={sel}>{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>Data</label><input type="date" name="purchased_at" required className={inputClass} /></div>
            <div><label className={labelClass}>Quantidade</label><input name="quantity" required inputMode="decimal" className={inputClass} /></div>
            <div><label className={labelClass}>Preço unitário</label><input name="unit_price" required inputMode="decimal" className={inputClass} /></div>
            <div><label className={labelClass}>Moeda</label><select name="currency" className={inputClass}><option>BRL</option><option>USD</option><option>EUR</option></select></div>
          </div>
          <div><label className={labelClass}>Fornecedor</label><input name="supplier_name" className={inputClass} /></div>
          {err && <p className="text-red-400">{err}</p>}
          <button className={btnClass("primary", "sm")}>Registrar</button>
        </form>
      )}
    </div>
  );
}
