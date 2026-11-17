"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fmtCompact, fmtPct } from "@/lib/format";
import { Badge, cn, inputClass } from "../ui";
import { Change } from "../market/bits";

export interface FundRow {
  cnpj: string; cnpjDigits: string; name: string; vehicle: string; classification: string | null; manager: string | null; netAssets: number;
  tags: string[]; exposureType: string; return12m: number | null; returnYtd: number | null; vol: number | null; dd: number | null; fee: string | null; quotaDate: string | null;
}

export const TAG_LABEL: Record<string, string> = { ouro: "Ouro", petroleo: "Petróleo", energia: "Energia", agro: "Agro", acucar: "Açúcar", cafe: "Café", metais: "Metais", commodities: "Commodities", dolar: "Dólar", emergentes: "Moedas emergentes", macro: "Macro global" };
export const EXPOSURE_LABEL: Record<string, { label: string; tone: "green" | "blue" | "gold" | "neutral" | "purple" }> = {
  direta_indice: { label: "Direta (índice)", tone: "green" },
  direta_cambial: { label: "Direta (câmbio)", tone: "green" },
  indireta_acoes: { label: "Indireta via ações", tone: "blue" },
  credito_ou_imoveis_agro: { label: "Fiagro: crédito/imóveis", tone: "purple" },
  multimercado_nao_verificada: { label: "Multimercado (não verificada)", tone: "gold" },
};
const VEHICLE: Record<string, string> = { etf: "ETF", fiagro: "Fiagro", multimercado: "Multimercado", acoes: "Ações", cambial: "Cambial" };

export function FundsTable({ funds, fixedVehicle }: { funds: FundRow[]; fixedVehicle?: string }) {
  const [q, setQ] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [vehicle, setVehicle] = useState(fixedVehicle ?? "");
  const [exp, setExp] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState<{ k: keyof FundRow; d: 1 | -1 }>({ k: "netAssets", d: -1 });
  const rows = useMemo(() => {
    const qq = q.toLowerCase();
    return funds
      .filter((f) => (!qq || f.name.toLowerCase().includes(qq) || (f.manager ?? "").toLowerCase().includes(qq) || f.cnpj.includes(qq)) &&
        tags.every((t) => f.tags.includes(t)) && (!vehicle || f.vehicle === vehicle) && (!exp || f.exposureType === exp) &&
        (!risk || (risk === "na" ? f.vol === null : f.vol !== null && (risk === "baixo" ? f.vol < 0.05 : risk === "medio" ? f.vol >= 0.05 && f.vol < 0.15 : f.vol >= 0.15))))
      .sort((a, b) => {
        const av = a[sort.k], bv = b[sort.k];
        if (av === null) return 1;
        if (bv === null) return -1;
        return (typeof av === "string" ? av.localeCompare(String(bv)) : (av as number) - (bv as number)) * sort.d;
      });
  }, [funds, q, tags, vehicle, exp, risk, sort]);
  const th = (k: keyof FundRow, l: string, cls = "text-right") => <th className={cn("cursor-pointer select-none", cls)} onClick={() => setSort((s) => ({ k, d: s.k === k ? (s.d === 1 ? -1 : 1) : -1 }))}>{l}{sort.k === k ? (sort.d === 1 ? " ↑" : " ↓") : ""}</th>;
  return (
    <div>
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72"><Search size={14} className="absolute left-2.5 top-2.5 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, gestor ou CNPJ" className={cn(inputClass, "h-8 pl-8 text-xs")} /></div>
          {!fixedVehicle && <select className={cn(inputClass, "h-8 w-40 text-xs")} value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="">Todos os veículos</option>{Object.entries(VEHICLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
          <select className={cn(inputClass, "h-8 w-56 text-xs")} value={exp} onChange={(e) => setExp(e.target.value)}><option value="">Todo tipo de exposição</option>{Object.entries(EXPOSURE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select className={cn(inputClass, "h-8 w-44 text-xs")} value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">Todo risco</option><option value="baixo">Volatilidade &lt; 5%</option><option value="medio">5% a 15%</option><option value="alto">&gt; 15%</option><option value="na">Sem dados de cota</option></select>
          <span className="ml-auto text-xs text-muted">{rows.length} de {funds.length}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(TAG_LABEL).map(([k, v]) => <button key={k} onClick={() => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))} className={cn("rounded-full border px-2.5 py-0.5 text-[11px]", tags.includes(k) ? "border-gold bg-gold/15 text-fg" : "border-line text-muted")}>{v}</button>)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="fin-table w-full min-w-[1150px] text-[12.5px]">
          <thead><tr>{th("name", "Fundo", "text-left")}<th>Veículo</th><th className="text-left">Exposição</th><th className="text-left">Temas (nome/classe)</th>{th("netAssets", "PL")}{th("return12m", "12m")}{th("returnYtd", "No ano")}{th("vol", "Vol. 12m")}{th("dd", "Drawdown máx.")}<th className="text-right">Taxa adm.</th><th className="text-left">Gestor</th></tr></thead>
          <tbody>
            {rows.slice(0, 300).map((f) => (
              <tr key={f.cnpjDigits}>
                <td className="max-w-[300px]"><Link href={`/invest/fundos/${f.cnpjDigits}`} className="block truncate font-medium hover:text-blue" title={f.name}>{f.name}</Link><div className="num text-[10.5px] text-muted">{f.cnpj}</div></td>
                <td className="text-center"><Badge>{VEHICLE[f.vehicle]}</Badge></td>
                <td><Badge tone={EXPOSURE_LABEL[f.exposureType]?.tone}>{EXPOSURE_LABEL[f.exposureType]?.label}</Badge></td>
                <td className="text-[11px]">{f.tags.map((t) => TAG_LABEL[t] ?? t).join(", ")}</td>
                <td className="num text-right">{fmtCompact(f.netAssets)}</td>
                <td className="text-right"><Change v={f.return12m} /></td>
                <td className="text-right"><Change v={f.returnYtd} /></td>
                <td className="num text-right">{fmtPct(f.vol, 1, false)}</td>
                <td className="num text-right text-down">{fmtPct(f.dd, 1, false)}</td>
                <td className="num text-right text-xs">{f.fee ? `${f.fee}%` : "—"}</td>
                <td className="max-w-[180px] truncate text-xs" title={f.manager ?? ""}>{f.manager ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
