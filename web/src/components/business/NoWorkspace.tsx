"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { btnClass, inputClass } from "../ui";

export function NoWorkspace() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="panel p-6">
        <Building2 className="mb-2 text-brand" />
        <h1 className="text-lg font-semibold">Crie o workspace da sua empresa</h1>
        <p className="mb-4 mt-1 text-sm text-muted">O Avermont Business guarda cotações, consumo e compras em um espaço isolado, com papéis e permissões para sua equipe.</p>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const companyName = new FormData(e.currentTarget).get("companyName");
            const r = await fetch("/api/business/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName }) });
            if (!r.ok) return setErr((await r.json()).error);
            router.refresh();
          }}
        >
          <input name="companyName" required minLength={2} placeholder="Nome da empresa" className={inputClass} />
          <button className={btnClass()}>Criar</button>
        </form>
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      </div>
    </div>
  );
}
