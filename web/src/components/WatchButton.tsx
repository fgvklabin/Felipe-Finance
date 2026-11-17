"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Star } from "lucide-react";
import { btnClass, cn } from "./ui";

export function WatchButton({ itemType, itemRef, initial, loggedIn }: { itemType: string; itemRef: string; initial: boolean; loggedIn: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (!loggedIn) return <Link href="/login" className={btnClass("outline", "sm")}><Star size={14} /> Watchlist</Link>;
  const toggle = async () => {
    setBusy(true);
    const r = await fetch("/api/watchlist", { method: on ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType, itemRef }) });
    if (r.ok) setOn(!on);
    setBusy(false);
  };
  return (
    <button onClick={toggle} disabled={busy} className={cn(btnClass("outline", "sm"), on && "border-gold text-gold")} aria-pressed={on}>
      <Star size={14} fill={on ? "currentColor" : "none"} /> {on ? "Na watchlist" : "Watchlist"}
    </button>
  );
}

export function AlertLink({ itemType, itemRef }: { itemType: string; itemRef: string }) {
  return (
    <Link href={`/alertas?type=${itemType}&ref=${itemRef}`} className={btnClass("outline", "sm")}>
      <Bell size={14} /> Criar alerta
    </Link>
  );
}
