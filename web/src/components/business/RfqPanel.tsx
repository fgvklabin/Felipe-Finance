"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { fmtDate, fmtNumber } from "@/lib/format";
import { Badge, btnClass, cn, inputClass, labelClass } from "../ui";

interface Rfq { id: string; title: string; commodity_id: string | null; quantity: number; unit: string; delivery_location: string; delivery_deadline: string | null; payment_terms: string | null; specification: string | null; quality_requirements: string | null; visibility: string; status: string; responses: number; created_at: string }

function rfqText(r: Rfq) {
  return `Pedido de cotação: ${r.title}\nQuantidade: ${fmtNumber(r.quantity, 0)} ${r.unit}\nEspecificação: ${r.specification ?? "—"}\nQualidade: ${r.quality_requirements ?? "—"}\nEntrega: ${r.delivery_location}${r.delivery_deadline ? " até " + fmtDate(r.delivery_deadline) : ""}\nPagamento: ${r.payment_terms ?? "a combinar"}\n\nPor favor, informe preço unitário, frete, impostos, prazo de entrega, pedido mínimo e validade da proposta.`;
}

export function RfqPanel({ rfqs, commodities, canEdit }: { rfqs: Rfq[]; commodities: { id: string; label: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/business/rfq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fd, commodity_id: fd.commodity_id || null, budget_max: fd.budget_max || null }) });
    const d = await r.json();
    if (!r.ok) return setErr(d.issues?.[0]?.message ?? d.error);
    setErr(null);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  };
  const setStatus = async (id: string, status: string) => {
    await fetch("/api/business/rfq", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    router.refresh();
  };
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[380px_1fr]">
      {canEdit ? (
        <form onSubmit={create} className="space-y-2 text-xs">
          <div><label className={labelClass}>Título</label><input name="title" required className={inputClass} placeholder="ex.: Milho para ração — dezembro" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>Commodity</label><select name="commodity_id" className={inputClass}><option value="">—</option>{commodities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div className="grid grid-cols-[1fr_70px] gap-1"><div><label className={labelClass}>Quantidade</label><input name="quantity" required inputMode="decimal" className={inputClass} /></div><div><label className={labelClass}>Un.</label><input name="unit" defaultValue="t" className={inputClass} /></div></div>
          </div>
          <div><label className={labelClass}>Especificação</label><input name="specification" className={inputClass} placeholder="umidade máx. 14%, impurezas…" /></div>
          <div><label className={labelClass}>Requisitos de qualidade</label><input name="quality_requirements" className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>Local de entrega</label><input name="delivery_location" required className={inputClass} /></div>
            <div><label className={labelClass}>Prazo</label><input type="date" name="delivery_deadline" className={inputClass} /></div>
            <div><label className={labelClass}>Pagamento</label><input name="payment_terms" className={inputClass} placeholder="ex.: 30 dias" /></div>
            <div><label className={labelClass}>Orçamento máx. (R$)</label><input name="budget_max" inputMode="decimal" className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>Visibilidade</label><select name="visibility" className={inputClass}><option value="private">Privado (envio manual)</option><option value="marketplace">Fornecedores cadastrados na Avermont</option></select></div>
          {err && <p className="text-red-400">{err}</p>}
          <button className={btnClass()}>Criar pedido de cotação</button>
          <p className="text-[11px] text-muted">Envio automático por e-mail/WhatsApp exige integração autorizada (roadmap). Hoje você compartilha o texto pronto com um clique.</p>
        </form>
      ) : <p className="text-xs text-muted">Seu papel no workspace é somente leitura.</p>}
      <div className="space-y-2">
        {rfqs.length === 0 && <p className="text-sm text-muted">Nenhum pedido de cotação ainda.</p>}
        {rfqs.map((r) => (
          <div key={r.id} className="rounded-lg border border-line p-3 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.title}</span>
              <Badge tone={r.status === "open" ? "green" : "neutral"}>{r.status === "open" ? "aberto" : r.status === "closed" ? "encerrado" : "cancelado"}</Badge>
              <Badge tone={r.visibility === "marketplace" ? "blue" : "neutral"}>{r.visibility === "marketplace" ? "marketplace" : "privado"}</Badge>
              <span className="ml-auto text-muted">{r.responses} resposta(s)</span>
            </div>
            <div className="mt-1 text-muted">{fmtNumber(r.quantity, 0)} {r.unit} · {r.delivery_location}{r.delivery_deadline ? ` · até ${fmtDate(r.delivery_deadline)}` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a className={cn(btnClass("outline", "sm"))} href={`mailto:?subject=${encodeURIComponent("Pedido de cotação — " + r.title)}&body=${encodeURIComponent(rfqText(r))}`}><Mail size={13} /> E-mail</a>
              <a className={cn(btnClass("outline", "sm"))} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(rfqText(r))}`}><MessageCircle size={13} /> WhatsApp</a>
              {canEdit && r.status === "open" && <button className={btnClass("ghost", "sm")} onClick={() => setStatus(r.id, "closed")}>Encerrar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
