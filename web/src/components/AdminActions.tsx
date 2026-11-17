"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnClass, inputClass } from "./ui";

async function call(action: string, body: unknown) {
  const r = await fetch(`/api/admin/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) alert((await r.json()).error);
}

export function UserActions({ id, isAdmin, status }: { id: string; isAdmin: boolean; status: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-1">
      <button className={btnClass("ghost", "sm")} onClick={async () => { await call("user", { userId: id, is_admin: !isAdmin }); router.refresh(); }}>{isAdmin ? "remover admin" : "tornar admin"}</button>
      {status !== "deleted" && <button className={btnClass("ghost", "sm")} onClick={async () => { await call("user", { userId: id, status: status === "active" ? "disabled" : "active" }); router.refresh(); }}>{status === "active" ? "desativar" : "reativar"}</button>}
    </div>
  );
}

export function VerificationReview({ id }: { id: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input className={`${inputClass} h-7 w-56 text-xs`} placeholder="Notas da análise (obrigatório)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className={btnClass("primary", "sm")} disabled={notes.length < 3} onClick={async () => { await call("verification", { requestId: id, decision: "approved", notes }); router.refresh(); }}>Aprovar</button>
      <button className={btnClass("danger", "sm")} disabled={notes.length < 3} onClick={async () => { await call("verification", { requestId: id, decision: "rejected", notes }); router.refresh(); }}>Reprovar</button>
    </div>
  );
}

export function FeedbackStatus({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  return (
    <select className={`${inputClass} h-7 w-28 text-xs`} defaultValue={status} onChange={async (e) => { await call("feedback", { id, status: e.target.value }); router.refresh(); }}>
      <option value="new">novo</option><option value="reviewed">analisado</option><option value="closed">fechado</option>
    </select>
  );
}
