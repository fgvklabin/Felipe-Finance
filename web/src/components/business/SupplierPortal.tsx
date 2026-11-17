"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDate, fmtNumber } from "@/lib/format";
import { Badge, btnClass, cn, inputClass, labelClass } from "../ui";

interface Rfq { id: string; title: string; commodity_id: string | null; specification: string | null; quality_requirements: string | null; quantity: number; unit: string; delivery_location: string; delivery_deadline: string | null; payment_terms: string | null }

export function SupplierPortal({ supplier, rfqs, commodities }: { supplier: { name: string; city: string | null; state: string | null; commodities: string[]; verification_status: string; contact_phone: string | null; website: string | null }; rfqs: Rfq[]; commodities: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>(supplier.commodities);
  const name = (id: string | null) => (id ? commodities.find((c) => c.id === id)?.label ?? id : "—");
  const post = async (url: string, body: unknown, method = "POST") => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setMsg(r.ok ? "Enviado." : d.issues?.[0] ? `${d.issues[0].path}: ${d.issues[0].message}` : d.error);
    if (r.ok) router.refresh();
    return r.ok;
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <div className="text-sm font-semibold">Pedidos de cotação abertos ({rfqs.length})</div>
        {rfqs.length === 0 && <p className="text-sm text-muted">Nenhum pedido aberto para os produtos do seu perfil.</p>}
        {rfqs.map((r) => (
          <div key={r.id} className="panel p-3 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.title}</span><Badge tone="green">{name(r.commodity_id)}</Badge></div>
            <div className="mt-1 text-muted">{fmtNumber(r.quantity, 0)} {r.unit} · entrega em {r.delivery_location}{r.delivery_deadline ? ` até ${fmtDate(r.delivery_deadline)}` : ""} · pagamento {r.payment_terms ?? "a combinar"}</div>
            {r.specification && <div className="mt-1">Especificação: {r.specification}</div>}
            {r.quality_requirements && <div>Qualidade: {r.quality_requirements}</div>}
            {open === r.id ? (
              <form
                className="mt-2 grid gap-2 sm:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = Object.fromEntries(new FormData(e.currentTarget));
                  if (await post("/api/supplier/quote", { ...fd, purchase_request_id: r.id, min_order_qty: fd.min_order_qty || null })) setOpen(null);
                }}
              >
                <div><label className={labelClass}>Preço unitário</label><input name="unit_price" required inputMode="decimal" className={inputClass} /></div>
                <div><label className={labelClass}>Moeda</label><select name="currency" className={inputClass}><option>BRL</option><option>USD</option></select></div>
                <div><label className={labelClass}>Frete total</label><input name="freight_total" defaultValue="0" inputMode="decimal" className={inputClass} /></div>
                <div><label className={labelClass}>Impostos %</label><input name="tax_pct" defaultValue="0" inputMode="decimal" className={inputClass} /></div>
                <div><label className={labelClass}>Prazo pgto. (dias)</label><input name="payment_days" defaultValue="30" className={inputClass} /></div>
                <div><label className={labelClass}>Entrega (dias)</label><input name="delivery_days" required className={inputClass} /></div>
                <div><label className={labelClass}>Pedido mínimo</label><input name="min_order_qty" className={inputClass} /></div>
                <div><label className={labelClass}>Validade</label><input type="date" name="valid_until" required className={inputClass} /></div>
                <div className="sm:col-span-2"><label className={labelClass}>Contato comercial</label><input name="contact" required className={inputClass} /></div>
                <div className="sm:col-span-2"><label className={labelClass}>Observações</label><input name="notes" className={inputClass} /></div>
                <div className="sm:col-span-4 flex gap-2"><button className={btnClass("primary", "sm")}>Enviar proposta</button><button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(null)}>Cancelar</button></div>
              </form>
            ) : <button className={cn(btnClass("outline", "sm"), "mt-2")} onClick={() => setOpen(r.id)}>Responder com proposta</button>}
          </div>
        ))}
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </div>
      <div className="space-y-4">
        <div className="panel space-y-2 p-4 text-xs">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">{supplier.name}</span><Badge tone={supplier.verification_status === "verified" ? "green" : supplier.verification_status === "pending" ? "gold" : "neutral"}>{supplier.verification_status}</Badge></div>
          <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.currentTarget)); await post("/api/supplier/profile", { ...fd, commodities: sel }, "PATCH"); }}>
            <div className="grid grid-cols-[1fr_60px] gap-1"><div><label className={labelClass}>Cidade</label><input name="city" defaultValue={supplier.city ?? ""} className={inputClass} /></div><div><label className={labelClass}>UF</label><input name="state" maxLength={2} defaultValue={supplier.state ?? ""} className={inputClass} /></div></div>
            <div><label className={labelClass}>Telefone</label><input name="contact_phone" defaultValue={supplier.contact_phone ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Site</label><input name="website" defaultValue={supplier.website ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Produtos fornecidos</label>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">{commodities.map((c) => <button type="button" key={c.id} onClick={() => setSel((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} className={cn("rounded-full border px-2 py-0.5", sel.includes(c.id) ? "border-brand bg-brand/10" : "border-line text-muted")}>{c.label}</button>)}</div>
            </div>
            <button className={btnClass("primary", "sm")}>Salvar perfil</button>
          </form>
        </div>
        {supplier.verification_status !== "verified" && (
          <div className="panel p-4 text-xs">
            <div className="mb-1 text-sm font-semibold">Solicitar verificação</div>
            <p className="mb-2 text-muted">Descreva documentos que comprovam a empresa (CNPJ ativo, inscrição estadual, licenças). A equipe Avermont analisa antes de exibir o selo “verificado”.</p>
            <form onSubmit={async (e) => { e.preventDefault(); await post("/api/supplier/verification", { evidence: new FormData(e.currentTarget).get("evidence") }); }}>
              <textarea name="evidence" required minLength={20} rows={4} className={cn(inputClass, "h-auto py-2")} />
              <button className={cn(btnClass("outline", "sm"), "mt-2")}>Enviar para análise</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
