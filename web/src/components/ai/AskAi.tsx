"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { btnClass, cn } from "../ui";

/** Abre a Avermont AI em tela cheia com uma pergunta pré-preenchida. */
export function AskAi({ question, label = "Perguntar à Avermont AI" }: { question: string; label?: string }) {
  return (
    <Link href={`/ai?q=${encodeURIComponent(question)}`} className={cn(btnClass("outline", "sm"), "border-violet-500/40 text-violet-400 hover:bg-violet-500/10")}>
      <Sparkles size={13} /> {label}
    </Link>
  );
}
