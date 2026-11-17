"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";

export function TeamManager({ members, selfId }: { members: { id: string; name: string; role: string }[]; selfId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = Object.fromEntries(new FormData(e.currentTarget));
          const r = await fetch("/api/business/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fd) });
          const d = await r.json();
          setMsg(r.ok ? (d.added ? "Membro adicionado." : "Convite registrado: será aceito quando a pessoa criar a conta.") : d.error);
          if (r.ok) router.refresh();
        }}
      >
        <input name="email" type="email" required placeholder="email@empresa.com.br" className={`${inputClass} max-w-xs`} />
        <select name="role" className={`${inputClass} w-36`}><option value="buyer">comprador</option><option value="viewer">leitor</option><option value="admin">administrador</option></select>
        <button className={btnClass()}>Convidar</button>
      </form>
      {msg && <p className="text-xs text-muted">{msg}</p>}
      <div className="space-y-1">
        {members.filter((m) => m.id !== selfId && m.role !== "owner").map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-xs">
            <span>{m.name} · {m.role}</span>
            <button className="text-red-400 hover:underline" onClick={async () => { await fetch("/api/business/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id }) }); router.refresh(); }}>remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}
