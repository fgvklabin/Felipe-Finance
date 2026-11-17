"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, btnClass, inputClass, labelClass } from "../ui";

interface Supplier { id: string; name: string; city: string | null; state: string | null; commodities: string[]; verification_status: string; is_demo: boolean; private_to_workspace: string | null; contact_email: string | null; contact_phone: string | null; website: string | null }

export function SupplierDirectory({ suppliers, names, canEdit }: { suppliers: Supplier[]; names: Record<string, string>; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3 p-4">
      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[760px] text-[12.5px]">
          <thead><tr><th className="text-left">Fornecedor</th><th className="text-left">Local</th><th className="text-left">Produtos</th><th>Verificação</th><th className="text-left">Contato</th><th>Tipo</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td>{[s.city, s.state].filter(Boolean).join(" / ") || "—"}</td>
                <td className="text-xs">{s.commodities.map((c) => names[c] ?? c).join(", ") || "—"}</td>
                <td className="text-center"><Badge tone={s.verification_status === "verified" ? "green" : s.verification_status === "pending" ? "gold" : "neutral"}>{s.is_demo ? "fictício" : { verified: "verificado", pending: "em análise", unverified: "não verificado", rejected: "reprovado" }[s.verification_status]}</Badge></td>
                <td className="text-xs">{s.is_demo ? <span className="text-muted">sem contato (demonstração)</span> : [s.contact_email, s.contact_phone, s.website].filter(Boolean).join(" · ") || "—"}</td>
                <td className="text-center">{s.is_demo ? <Badge tone="purple">demo</Badge> : s.private_to_workspace ? <Badge>seu cadastro</Badge> : <Badge tone="blue">Avermont</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">“Verificado” só é atribuído após análise de documentos pela equipe Avermont. Nunca exibimos contatos, disponibilidade ou cotações que não foram informados pelo próprio fornecedor ou por você.</p>
      {canEdit && (
        <div>
          <button className={btnClass("outline", "sm")} onClick={() => setOpen((v) => !v)}>+ Fornecedor não cadastrado na Avermont</button>
          {open && (
            <form
              className="mt-2 grid gap-2 text-xs sm:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
                const r = await fetch("/api/business/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fd, commodities: fd.commodities ? fd.commodities.split(",").map((x) => x.trim()).filter(Boolean) : [] }) });
                const d = await r.json();
                if (!r.ok) return setErr(d.issues?.[0] ? `${d.issues[0].path}: ${d.issues[0].message}` : d.error);
                setErr(null);
                setOpen(false);
                router.refresh();
              }}
            >
              <div><label className={labelClass}>Nome</label><input name="name" required className={inputClass} /></div>
              <div><label className={labelClass}>CNPJ</label><input name="cnpj" placeholder="00.000.000/0000-00" className={inputClass} /></div>
              <div className="grid grid-cols-[1fr_60px] gap-1"><div><label className={labelClass}>Cidade</label><input name="city" className={inputClass} /></div><div><label className={labelClass}>UF</label><input name="state" maxLength={2} className={inputClass} /></div></div>
              <div><label className={labelClass}>E-mail</label><input name="contact_email" type="email" className={inputClass} /></div>
              <div><label className={labelClass}>Telefone</label><input name="contact_phone" className={inputClass} /></div>
              <div><label className={labelClass}>Produtos (ids, separados por vírgula)</label><input name="commodities" placeholder="milho, farelo-soja" className={inputClass} /></div>
              {err && <p className="text-red-400 sm:col-span-3">{err}</p>}
              <div className="sm:col-span-3"><button className={btnClass("primary", "sm")}>Salvar (visível só para seu workspace)</button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
