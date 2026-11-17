"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnClass, inputClass, labelClass } from "./ui";

export function CalendarEventForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const fd = new FormData(e.currentTarget);
        const r = await fetch("/api/admin/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd)) });
        const d = await r.json();
        setBusy(false);
        setMsg(r.ok ? "Evento cadastrado." : d.error);
        if (r.ok) {
          (e.target as HTMLFormElement).reset();
          router.refresh();
        }
      }}
    >
      <div><label className={labelClass}>Título</label><input name="title" required maxLength={200} className={inputClass} /></div>
      <div><label className={labelClass}>Data e hora</label><input name="startsAt" type="datetime-local" required className={inputClass} /></div>
      <div><label className={labelClass}>Categoria</label><select name="category" className={inputClass}><option value="macro">macro</option><option value="commodities">commodities</option><option value="moedas">moedas</option><option value="empresas">empresas</option></select></div>
      <div><label className={labelClass}>Fonte</label><input name="sourceName" required className={inputClass} placeholder="ex.: Banco Central do Brasil" /></div>
      <div><label className={labelClass}>Link da fonte oficial</label><input name="sourceUrl" type="url" required className={inputClass} placeholder="https://" /></div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirmed" value="1" /> Data confirmada na fonte</label>
      <button className={btnClass()} disabled={busy}>Cadastrar</button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </form>
  );
}
