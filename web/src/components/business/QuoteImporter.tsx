"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2, PenLine, Upload } from "lucide-react";
import { CSV_TEMPLATE, mapRows, parseCsv, validateDraft, type DraftQuote } from "@/lib/quote-import";
import { Badge, btnClass, cn, inputClass } from "../ui";

const EMPTY: DraftQuote = {
  supplier_name: "", product: "", specification: null, unit: "t", quantity: null, unit_price: null, currency: "BRL", freight_total: 0, tax_pct: 0,
  payment_days: 0, delivery_days: null, delivery_location: null, min_order_qty: null, valid_until: null, contact: null, commodity_id: null,
  verified: false, source: "manual", issues: [],
};

type Tab = "manual" | "csv" | "xlsx" | "ai";

export function QuoteImporter({ commodities, rfqId }: { commodities: { id: string; label: string }[]; rfqId?: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("manual");
  const [drafts, setDrafts] = useState<DraftQuote[]>([{ ...EMPTY }]);
  const [defaultCommodity, setDefaultCommodity] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "warn"; text: string } | null>(null);

  const update = (i: number, patch: Partial<DraftQuote>) =>
    setDrafts((d) => d.map((x, j) => (j === i ? (() => { const n = { ...x, ...patch }; n.issues = validateDraft(n); return n; })() : x)));

  const onFile = async (f: File) => {
    setMsg(null);
    setBusy(true);
    try {
      if (tab === "csv") {
        const rows = mapRows(parseCsv(await f.text()), "csv");
        if (!rows.length) throw new Error("Nenhuma linha reconhecida. Use o modelo de CSV.");
        setDrafts(rows);
      } else if (tab === "xlsx") {
        const { readSheet } = await import("read-excel-file/browser");
        const data = await readSheet(f);
        const rows = mapRows(data as unknown[][], "xlsx");
        if (!rows.length) throw new Error("Nenhuma linha reconhecida na primeira aba.");
        setDrafts(rows);
      } else if (tab === "ai") {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/quotes/extract", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        const src = f.type === "application/pdf" ? "pdf_ai" : "image_ai";
        const rows: DraftQuote[] = d.quotes.map((q: Record<string, unknown>) => {
          const x = { ...EMPTY, ...Object.fromEntries(Object.entries(q).filter(([, v]) => v !== null)), source: src, verified: false } as DraftQuote;
          x.issues = validateDraft(x);
          return x;
        });
        setDrafts(rows.length ? rows : [{ ...EMPTY }]);
        setMsg({ tone: "warn", text: `IA extraiu ${rows.length} proposta(s). Confira cada valor com o documento original antes de confirmar.${d.warnings?.length ? " Avisos: " + d.warnings.join("; ") : ""}` });
      }
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const ready = drafts.filter((d) => d.issues.length === 0);
    if (!ready.length) return setMsg({ tone: "err", text: "Nenhuma linha válida para salvar." });
    if (ready.some((d) => !d.verified)) return setMsg({ tone: "err", text: "Marque “Verifiquei” em todas as linhas válidas antes de salvar." });
    setBusy(true);
    const body = ready.map((d) => ({
      ...d, commodity_id: d.commodity_id || defaultCommodity || null, purchase_request_id: rfqId ?? null, issues: undefined,
      extraction: d.source.endsWith("_ai") ? { evidence: d.evidence ?? null } : null,
    }));
    const r = await fetch("/api/business/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "err", text: data.issues?.[0] ? `${data.issues[0].path}: ${data.issues[0].message}` : data.error });
    setMsg({ tone: "ok", text: `${data.ids.length} cotação(ões) salva(s).` });
    setDrafts([{ ...EMPTY }]);
    router.refresh();
  };

  const TABS: { id: Tab; label: string; icon: typeof PenLine; accept?: string }[] = [
    { id: "manual", label: "Manual", icon: PenLine },
    { id: "csv", label: "CSV", icon: FileText, accept: ".csv,text/csv" },
    { id: "xlsx", label: "Excel", icon: FileSpreadsheet, accept: ".xlsx" },
    { id: "ai", label: "PDF / imagem (IA)", icon: Upload, accept: "application/pdf,image/png,image/jpeg,image/webp" },
  ];
  const active = TABS.find((t) => t.id === tab)!;
  const cell = cn(inputClass, "h-8 px-2 text-xs");

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setMsg(null); if (t.id === "manual") setDrafts([{ ...EMPTY }]); }} className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs", tab === t.id ? "border-blue bg-blue/10 text-fg" : "border-line text-muted")}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
        <select value={defaultCommodity} onChange={(e) => setDefaultCommodity(e.target.value)} className={cn(inputClass, "ml-auto h-8 w-56 text-xs")} aria-label="Commodity das cotações">
          <option value="">Commodity (opcional)</option>
          {commodities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      {tab !== "manual" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line p-3 text-xs">
          <label className={cn(btnClass("outline", "sm"), "cursor-pointer")}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Escolher arquivo
            <input type="file" accept={active.accept} className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {tab === "csv" && <a className="text-blue underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="modelo-cotacoes-avermont.csv">Baixar modelo CSV</a>}
          {tab === "ai" && <span className="text-muted">A IA lê o documento e preenche a tabela abaixo; você confere e confirma. Nada é salvo sem sua verificação.</span>}
          {tab === "xlsx" && <span className="text-muted">Primeira aba; cabeçalhos como no modelo CSV.</span>}
        </div>
      )}
      {msg && <div className={cn("rounded-lg border px-3 py-2 text-xs", msg.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/10" : msg.tone === "warn" ? "border-amber-500/30 bg-amber-500/10" : "border-red-500/30 bg-red-500/10 text-red-400")}>{msg.text}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted">
            <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left">
              <th>Fornecedor*</th><th>Produto*</th><th>Especificação</th><th>Un.</th><th>Qtd*</th><th>Preço un.*</th><th>Moeda</th><th>Frete total</th><th>Impostos %</th><th>Pgto (dias)</th><th>Entrega (dias)</th><th>Local</th><th>Mínimo</th><th>Validade</th><th>Contato</th><th>Verifiquei</th><th />
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, i) => (
              <tr key={i} className="[&>td]:px-1 [&>td]:py-1 align-top">
                <td><input className={cell} value={d.supplier_name} onChange={(e) => update(i, { supplier_name: e.target.value })} /></td>
                <td><input className={cell} value={d.product} onChange={(e) => update(i, { product: e.target.value })} /></td>
                <td><input className={cell} value={d.specification ?? ""} onChange={(e) => update(i, { specification: e.target.value || null })} /></td>
                <td><input className={cn(cell, "w-14")} value={d.unit} onChange={(e) => update(i, { unit: e.target.value })} /></td>
                <td><input className={cn(cell, "w-20")} inputMode="decimal" value={d.quantity ?? ""} onChange={(e) => update(i, { quantity: Number(e.target.value.replace(",", ".")) || null })} /></td>
                <td><input className={cn(cell, "w-24")} inputMode="decimal" value={d.unit_price ?? ""} onChange={(e) => update(i, { unit_price: Number(e.target.value.replace(",", ".")) || null })} /></td>
                <td><select className={cn(cell, "w-16")} value={d.currency} onChange={(e) => update(i, { currency: e.target.value as DraftQuote["currency"] })}><option>BRL</option><option>USD</option><option>EUR</option></select></td>
                <td><input className={cn(cell, "w-20")} inputMode="decimal" value={d.freight_total} onChange={(e) => update(i, { freight_total: Number(e.target.value.replace(",", ".")) || 0 })} /></td>
                <td><input className={cn(cell, "w-14")} inputMode="decimal" value={d.tax_pct} onChange={(e) => update(i, { tax_pct: Number(e.target.value.replace(",", ".")) || 0 })} /></td>
                <td><input className={cn(cell, "w-14")} inputMode="numeric" value={d.payment_days} onChange={(e) => update(i, { payment_days: Number(e.target.value) || 0 })} /></td>
                <td><input className={cn(cell, "w-14")} inputMode="numeric" value={d.delivery_days ?? ""} onChange={(e) => update(i, { delivery_days: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td><input className={cell} value={d.delivery_location ?? ""} onChange={(e) => update(i, { delivery_location: e.target.value || null })} /></td>
                <td><input className={cn(cell, "w-16")} inputMode="decimal" value={d.min_order_qty ?? ""} onChange={(e) => update(i, { min_order_qty: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })} /></td>
                <td><input type="date" className={cell} value={d.valid_until ?? ""} onChange={(e) => update(i, { valid_until: e.target.value || null })} /></td>
                <td><input className={cell} value={d.contact ?? ""} onChange={(e) => update(i, { contact: e.target.value || null })} /></td>
                <td className="text-center">
                  <input type="checkbox" checked={d.verified} disabled={d.issues.length > 0} onChange={(e) => update(i, { verified: e.target.checked })} aria-label="Verifiquei os valores" />
                  {d.issues.length > 0 && <div className="mt-0.5 max-w-[110px] text-[10px] text-red-400">{d.issues.join("; ")}</div>}
                  {d.source.endsWith("_ai") && d.evidence && <div className="mt-0.5 max-w-[140px] text-[10px] text-muted" title={d.evidence}>“{d.evidence.slice(0, 60)}”</div>}
                </td>
                <td><button className="text-muted hover:text-red-400" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} aria-label="Remover linha">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={btnClass("outline", "sm")} onClick={() => setDrafts((d) => [...d, { ...EMPTY }])}>+ Linha</button>
        <button className={btnClass("primary", "sm")} onClick={save} disabled={busy}>Salvar cotações verificadas</button>
        <Badge tone="gold">Exigimos sua verificação antes de usar qualquer valor</Badge>
      </div>
    </div>
  );
}
