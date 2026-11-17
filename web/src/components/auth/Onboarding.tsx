"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnClass, cn, inputClass } from "../ui";

interface Opt { id: string; label: string; category: string; demo: boolean }

export function Onboarding({ accountType, options }: { accountType: string; options: Opt[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [mats, setMats] = useState<Record<string, { consumption: string; price: string; unit: string }>>({});
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const title = accountType === "business" ? "Quais matérias-primas sua empresa compra?" : accountType === "supplier" ? "Quais produtos você fornece?" : "Quais mercados você quer acompanhar?";
  const submit = async () => {
    setBusy(true);
    const body =
      accountType === "business"
        ? { watch: picked, materials: picked.filter((id) => !id.includes("brl") && !id.includes("usd")).map((id) => ({ commodityId: id, consumption: Number(mats[id]?.consumption || 0), price: Number(mats[id]?.price || 0), unit: mats[id]?.unit || "t" })) }
        : accountType === "supplier"
          ? { supplies: picked, watch: picked }
          : { watch: picked };
    const r = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    router.push(d.next ?? "/visao-geral");
    router.refresh();
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} onClick={() => toggle(o.id)} className={cn("rounded-full border px-3 py-1 text-xs", picked.includes(o.id) ? "border-brand bg-brand/15 text-fg" : "border-line text-muted hover:text-fg")}>
            {o.label}{o.demo ? " · demo" : ""}
          </button>
        ))}
      </div>
      {accountType === "business" && picked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Opcional: informe consumo mensal e preço atual de compra (R$ por unidade). Esses dados ficam privados no seu workspace.</p>
          {picked.filter((id) => options.find((o) => o.id === id)?.category !== "moedas").map((id) => (
            <div key={id} className="grid grid-cols-[1.5fr_1fr_1fr_80px] items-center gap-2 text-xs">
              <span>{options.find((o) => o.id === id)?.label}</span>
              <input className={cn(inputClass, "h-8")} placeholder="consumo/mês" inputMode="decimal" onChange={(e) => setMats((m) => ({ ...m, [id]: { ...m[id], consumption: e.target.value } }))} />
              <input className={cn(inputClass, "h-8")} placeholder="R$/unidade" inputMode="decimal" onChange={(e) => setMats((m) => ({ ...m, [id]: { ...m[id], price: e.target.value } }))} />
              <select className={cn(inputClass, "h-8")} onChange={(e) => setMats((m) => ({ ...m, [id]: { ...m[id], unit: e.target.value } }))}><option>t</option><option>kg</option><option>saca</option><option>m³</option><option>L</option></select>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button className={btnClass()} onClick={submit} disabled={busy}>Continuar</button>
        <button className={btnClass("ghost")} onClick={() => router.push("/visao-geral")}>Pular</button>
      </div>
    </div>
  );
}
