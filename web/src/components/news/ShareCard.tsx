"use client";

import { useState } from "react";
import { Briefcase, Download, MessageCircle, Share2 } from "lucide-react";
import { btnClass, cn } from "../ui";

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Card de inteligência de mercado em imagem (1080×1080) para Instagram + links de WhatsApp/LinkedIn. */
export function ShareCard({ title, summary, source, date, url }: { title: string; summary: string; source: string; date: string; url: string }) {
  const [open, setOpen] = useState(false);
  const svg = () => {
    const t = wrap(title, 30).slice(0, 4);
    const s = wrap(summary, 52).slice(0, 6);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1423"/><stop offset="1" stop-color="#13223d"/></linearGradient>
<linearGradient id="a" x1="0" x2="1"><stop offset="0" stop-color="#10B981"/><stop offset=".5" stop-color="#3B82F6"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
<rect width="1080" height="1080" fill="url(#g)"/><rect x="0" y="0" width="1080" height="12" fill="url(#a)"/>
<text x="80" y="130" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#E8EEF8">Avermont</text>
<text x="80" y="170" font-family="Inter, Arial, sans-serif" font-size="20" fill="#8193B0" letter-spacing="3">COMMODITY INTELLIGENCE</text>
${t.map((l, i) => `<text x="80" y="${300 + i * 72}" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="700" fill="#FFFFFF">${esc(l)}</text>`).join("")}
${s.map((l, i) => `<text x="80" y="${330 + t.length * 72 + 40 + i * 44}" font-family="Inter, Arial, sans-serif" font-size="30" fill="#B6C3D8">${esc(l)}</text>`).join("")}
<text x="80" y="960" font-family="Inter, Arial, sans-serif" font-size="24" fill="#8193B0">Fonte: ${esc(source)} · ${esc(date)}</text>
<text x="80" y="1000" font-family="Inter, Arial, sans-serif" font-size="20" fill="#5d6d88">Conteúdo informativo. Não é recomendação de investimento.</text>
<text x="1000" y="1000" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="22" fill="#10B981">Understand markets. Anticipate opportunities.</text></svg>`;
  };
  const absolute = () => (typeof window === "undefined" ? url : new URL(url, window.location.origin).toString());
  const download = async () => {
    const blob = new Blob([svg()], { type: "image/svg+xml" });
    const img = new Image();
    const src = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1080;
      c.getContext("2d")!.drawImage(img, 0, 0);
      c.toBlob((png) => {
        if (!png) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = "avermont-card.png";
        a.click();
      }, "image/png");
      URL.revokeObjectURL(src);
    };
    img.src = src;
  };
  return (
    <div>
      <button className={btnClass("ghost", "sm")} onClick={() => setOpen((v) => !v)}><Share2 size={14} /> Compartilhar card</button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a className={cn(btnClass("outline", "sm"), "border-emerald-500/40")} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${absolute()}`)}`}><MessageCircle size={14} /> WhatsApp</a>
          <a className={cn(btnClass("outline", "sm"), "border-blue-500/40")} target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absolute())}`}><Briefcase size={14} /> LinkedIn</a>
          <button className={cn(btnClass("outline", "sm"), "border-pink-500/40")} onClick={download}><Download size={14} /> Imagem para Instagram</button>
          <span className="text-[11px] text-muted">O Instagram não aceita links de compartilhamento: baixe a imagem e publique.</span>
        </div>
      )}
    </div>
  );
}
