"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { Badge, btnClass, cn, inputClass, labelClass } from "./ui";

interface Alert { id: string; alert_type: string; item_type: string; item_ref: string; threshold: number | null; channels: string[]; active: boolean; last_triggered_at: string | null }
interface Notif { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string }
interface Opt { type: string; ref: string; label: string }

const TYPES: Record<string, { label: string; needs: boolean; items: string[]; unit?: string }> = {
  price_above: { label: "Preço acima de", needs: true, items: ["commodity", "currency"], unit: "valor" },
  price_below: { label: "Preço abaixo de", needs: true, items: ["commodity", "currency"], unit: "valor" },
  pct_change_up: { label: "Alta de pelo menos", needs: true, items: ["commodity", "currency"], unit: "%" },
  pct_change_down: { label: "Queda de pelo menos", needs: true, items: ["commodity", "currency"], unit: "%" },
  fx_move: { label: "Movimento forte do câmbio", needs: true, items: ["currency"], unit: "%" },
  forecast_change: { label: "Mudança na previsão", needs: false, items: ["commodity", "currency"] },
  news: { label: "Nova nota de mercado", needs: false, items: ["commodity", "company"] },
  company_results: { label: "Novos resultados da empresa", needs: false, items: ["company"] },
  fund_exposure: { label: "Mudança na exposição do fundo", needs: false, items: ["fund"] },
  new_quote: { label: "Nova cotação de fornecedor", needs: false, items: ["workspace"] },
};

export function AlertsManager({ alerts, notifications, options, prefill }: { alerts: Alert[]; notifications: Notif[]; options: Opt[]; prefill?: { type?: string; ref?: string } }) {
  const router = useRouter();
  const [type, setType] = useState(prefill?.type === "company" ? "company_results" : "pct_change_up");
  const [ref, setRef] = useState(prefill?.ref ?? "");
  const [threshold, setThreshold] = useState("");
  const [email, setEmail] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = TYPES[type];
  const opts = options.filter((o) => t.items.includes(o.type));
  const sel = opts.find((o) => o.ref === ref) ?? opts[0];
  const label = (o: Alert) => options.find((x) => x.ref === o.item_ref)?.label ?? o.item_ref;
  const call = async (body: unknown) => {
    const r = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error);
    else router.refresh();
    return d;
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="panel space-y-3 p-4">
        <div className="text-sm font-semibold">Novo alerta</div>
        <div><label className={labelClass}>Quando…</label><select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        {type !== "new_quote" && <div><label className={labelClass}>Item</label><select className={inputClass} value={sel?.ref ?? ""} onChange={(e) => setRef(e.target.value)}>{opts.map((o) => <option key={o.type + o.ref} value={o.ref}>{o.label}</option>)}</select></div>}
        {t.needs && <div><label className={labelClass}>{t.unit === "%" ? "Percentual (%)" : "Valor de referência"}</label><input className={inputClass} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked readOnly /> Notificação no app</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> E-mail (ative também em Configurações)</label>
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" disabled /> WhatsApp — em breve, com sua autorização</label>
        <button className={btnClass()} onClick={() => { setMsg(null); call({ action: "create", alert_type: type, item_type: type === "new_quote" ? "workspace" : sel?.type, item_ref: type === "new_quote" ? "workspace" : sel?.ref, threshold: t.needs ? Number(threshold.replace(",", ".")) : null, channels: email ? ["in_app", "email"] : ["in_app"] }); }}>Criar alerta</button>
        {msg && <p className="text-xs text-red-400">{msg}</p>}
      </div>
      <div className="space-y-5">
        <div className="panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Meus alertas ({alerts.length})</span>
            <button className={btnClass("outline", "sm")} onClick={async () => { const d = await call({ action: "run" }); setMsg(`Verificados ${d.evaluated} alertas; ${d.fired} disparado(s).`); }}>Verificar agora</button>
          </div>
          <ul className="divide-y divide-line">
            {alerts.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nenhum alerta ainda.</li>}
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
                <span className="font-medium">{TYPES[a.alert_type]?.label}</span>
                {a.threshold !== null && <span className="num">{a.threshold}{TYPES[a.alert_type]?.unit === "%" ? "%" : ""}</span>}
                <span className="text-fg-2">· {label(a)}</span>
                {a.channels.includes("email") && <Badge>e-mail</Badge>}
                <span className="ml-auto text-[11px] text-muted">{a.last_triggered_at ? `último disparo ${fmtDateTime(a.last_triggered_at)}` : "ainda não disparou"}</span>
                <button onClick={() => call({ action: "toggle", id: a.id })} className={cn("rounded-md border px-2 py-0.5 text-[11px]", a.active ? "border-emerald-500/40 text-emerald-500" : "border-line text-muted")}>{a.active ? "ativo" : "pausado"}</button>
                <button onClick={() => call({ action: "delete", id: a.id })} className="text-muted hover:text-red-400" aria-label="Excluir"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notificações</span>
            <button className="text-xs text-blue hover:underline" onClick={() => call({ action: "read_all" })}>marcar todas como lidas</button>
          </div>
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Sem notificações.</li>}
            {notifications.map((n) => (
              <li key={n.id} className={cn("px-4 py-2.5 text-[13px]", !n.read_at && "bg-blue/5")}>
                <div className="flex items-center gap-2">{!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-blue" />}<span className="font-medium">{n.link ? <Link href={n.link} className="hover:text-blue">{n.title}</Link> : n.title}</span><span className="ml-auto text-[11px] text-muted">{fmtDateTime(n.created_at)}</span></div>
                <div className="text-fg-2">{n.body}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
