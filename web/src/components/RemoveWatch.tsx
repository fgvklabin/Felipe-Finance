"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function RemoveWatch({ itemType, itemRef }: { itemType: string; itemRef: string }) {
  const router = useRouter();
  return (
    <button
      className="text-muted hover:text-red-400"
      aria-label="Remover da watchlist"
      onClick={async () => {
        await fetch("/api/watchlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType, itemRef }) });
        router.refresh();
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}
