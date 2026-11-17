"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import type { PortfolioView } from "@/lib/portfolio-data";
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import { Badge, btnClass, Card, CardBody, CardHeader, cn, inputClass, labelClass, Stat } from "../ui";
import { Change } from "../market/bits";

export interface AssetOption { type: "currency" | "commodity" | "stock" | "fund" | "cash"; ref: string; label: string; price: number | null; unitHint: string }

const TYPE_LABEL = { currency: "Moeda", commodity: "Commodity", stock: "Ação", fund: "Fundo", cash: "Caixa (CDI)" } as const;

async function api(body: unknown) {
  const r = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.issues?.[0]?.message ?? d.error);
  return d;
}

export function PortfolioManager({ portfolios, options }: { portfolios: PortfolioView[]; options: AssetOption[] }) {
  const router = useRouter();
  const [active, setActive] = useState(portfolios[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState<AssetOption["type"]>("currency");
  const [ref, setRef] = useState("");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const pf = portfolios.find((p) => p.id === active);
  const opts = useMemo(() => options.filter((o) => o.type === type), [options, type]);
  const opt = opts.find((o) => o.ref === ref) ?? opts[0];

  const run = async (body: unknown) => {
    try {
      setErr(null);
      await api(body);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!portfolios.length) {
    return (
      <Card>
        <CardBody>
          <p className="mb-3 text-sm text-fg-2">Crie sua primeira carteira simulada para acompanhar, dia a dia, moedas, commodities, fundos, ações ligadas a commodities e caixa.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run({ action: "create_portfolio", name: new FormData(e.currentTarget).get("name") }); }}>
            <input name="name" required defaultValue="Minha carteira" className={cn(inputClass, "max-w-xs")} />
            <button className={btnClass()}>Criar carteira</button>
          </form>
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        </CardBody>
      </Card>
    );
  }

  const chart = pf?.snapshots.map((s) => ({ d: s.snapshot_date, v: Math.round(s.total_value), i: Math.round(s.invested_value) })) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {portfolios.map((p) => <button key={p.id} onClick={() => setActive(p.id)} className={cn("rounded-full border px-3 py-1 text-xs", p.id === active ? "border-blue bg-blue/15" : "border-line text-muted")}>{p.name}</button>)}
        <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); run({ action: "create_portfolio", name: new FormData(e.currentTarget).get("name") }); (e.target as HTMLFormElement).reset(); }}>
          <input name="name" required placeholder="Nova carteira" className={cn(inputClass, "h-8 w-40 text-xs")} />
          <button className={btnClass("outline", "sm")}>+</button>
        </form>
        {pf && <button className="ml-auto text-xs text-red-400 hover:underline" onClick={() => confirm("Excluir esta carteira e todo o histórico?") && run({ action: "delete_portfolio", id: pf.id })}>excluir carteira</button>}
      </div>
      {pf && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-3"><Stat label="Valor atual" value={fmtMoney(pf.total, "BRL", "pt", 2)} sub={pf.missing ? `${pf.missing} posição(ões) sem preço` : `${pf.positions.length} posições`} /></Card>
            <Card className="p-3"><Stat label="Investido" value={fmtMoney(pf.invested, "BRL", "pt", 2)} /></Card>
            <Card className="p-3"><Stat label="Resultado" value={<span className={pf.total - pf.invested >= 0 ? "text-up" : "text-down"}>{fmtMoney(pf.total - pf.invested)}</span>} sub={pf.invested ? fmtPct(pf.total / pf.invested - 1) : "—"} /></Card>
            <Card className="p-3"><Stat label="Acompanhamento diário" value={`${pf.snapshots.length} dia(s)`} sub={`desde ${fmtDate(pf.snapshots[0]?.snapshot_date)}`} /></Card>
          </div>

          <Card>
            <CardHeader title="Posições" subtitle="Preços de fontes oficiais; ações exigem preço informado por você" />
            <div className="overflow-x-auto">
              <table className="fin-table w-full min-w-[1000px] text-[12.5px]">
                <thead><tr><th className="text-left">Ativo</th><th>Tipo</th><th className="text-right">Quantidade</th><th className="text-right">Preço entrada</th><th className="text-right">Preço atual</th><th className="text-right">Valor</th><th className="text-right">Resultado</th><th className="text-left">Fonte / data</th><th /></tr></thead>
                <tbody>
                  {pf.positions.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-sm text-muted">Adicione posições abaixo.</td></tr>}
                  {pf.positions.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.label}</td>
                      <td className="text-center"><Badge tone={p.asset_type === "stock" ? "blue" : p.asset_type === "fund" ? "gold" : p.asset_type === "cash" ? "neutral" : p.asset_type === "currency" ? "cyan" : "green"}>{TYPE_LABEL[p.asset_type]}</Badge></td>
                      <td className="num text-right">{fmtNumber(p.quantity, p.asset_type === "fund" ? 4 : 2)}</td>
                      <td className="num text-right">{fmtNumber(p.entry_price, 4)}</td>
                      <td className="num text-right">
                        {p.price !== null ? fmtNumber(p.price, 4) : "—"}
                        {p.asset_type === "stock" && (
                          <form className="mt-1 flex justify-end gap-1" onSubmit={(e) => { e.preventDefault(); run({ action: "set_price", position_id: p.id, manual_price: new FormData(e.currentTarget).get("price") }); }}>
                            <input name="price" inputMode="decimal" placeholder="novo preço" className={cn(inputClass, "h-6 w-20 px-1 text-[11px]")} />
                            <button className="text-[10px] text-blue underline">ok</button>
                          </form>
                        )}
                      </td>
                      <td className="num text-right font-semibold">{fmtMoney(p.value)}</td>
                      <td className="text-right"><span className="num">{fmtMoney(p.pnl)}</span><div><Change v={p.pnlPct} /></div></td>
                      <td className="max-w-[240px] text-[11px] text-muted">{p.source} · {fmtDate(p.priceDate)} {p.stale && <Badge tone="gold">desatualizado</Badge>}{p.note && <div>{p.note}</div>}</td>
                      <td><button className="text-muted hover:text-red-400" onClick={() => run({ action: "delete_position", id: p.id })} aria-label="Remover"><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" onSubmit={(e) => {
                e.preventDefault();
                if (!opt) return;
                run({ action: "add_position", portfolio_id: pf.id, asset_type: type, asset_ref: opt.ref, label: opt.label, quantity: qty, entry_price: entry || undefined });
                setQty(""); setEntry("");
              }}>
                <div><label className={labelClass}>Tipo</label><select className={cn(inputClass, "h-8 text-xs")} value={type} onChange={(e) => { setType(e.target.value as AssetOption["type"]); setRef(""); }}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div className="lg:col-span-2"><label className={labelClass}>Ativo</label><select className={cn(inputClass, "h-8 text-xs")} value={opt?.ref ?? ""} onChange={(e) => setRef(e.target.value)}>{opts.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}</select></div>
                <div><label className={labelClass}>{type === "cash" ? "Valor (R$)" : `Quantidade (${opt?.unitHint ?? ""})`}</label><input className={cn(inputClass, "h-8 text-xs")} required inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
                {type !== "cash" && <div><label className={labelClass}>Preço de entrada (R$)</label><input className={cn(inputClass, "h-8 text-xs")} inputMode="decimal" placeholder={opt?.price ? `atual: ${fmtNumber(opt.price, 4)}` : "obrigatório"} value={entry} onChange={(e) => setEntry(e.target.value)} /></div>}
                <div className="flex items-end"><button className={btnClass("primary", "sm")}>Adicionar</button></div>
              </form>
              {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Evolução diária" subtitle="Um registro por dia (gravado ao abrir a carteira e pelo agendador diário)" />
              <CardBody>
                {chart.length < 2 ? <p className="text-sm text-muted">O histórico começa hoje. A cada dia um novo ponto é registrado automaticamente.</p> : (
                  <div className="h-[220px]">
                    <ResponsiveContainer>
                      <AreaChart data={chart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="d" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                        <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} domain={["auto", "auto"]} width={80} />
                        <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                        <Area dataKey="v" name="Valor" stroke="#10B981" fill="#10B98133" />
                        <Area dataKey="i" name="Investido" stroke="#8193b0" fill="transparent" strokeDasharray="4 3" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs">
                  {[...pf.snapshots].reverse().map((s) => <li key={s.snapshot_date} className="flex justify-between border-b border-line py-1"><span className="num">{fmtDate(s.snapshot_date)}</span><span className="num">{fmtMoney(s.total_value)}</span></li>)}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Projeção para o futuro" subtitle="Avermont Forecast Engine (moedas/commodities) + Focus (CDI). Faixa conservadora." accent="var(--blue)" />
              <CardBody>
                <table className="fin-table w-full text-[13px]">
                  <thead><tr><th className="text-left">Horizonte</th><th className="text-right">Central</th><th className="text-right">Faixa</th><th className="text-right">Coberto por previsão</th></tr></thead>
                  <tbody>
                    {(["30d", "90d", "180d"] as const).map((h) => {
                      const pr = pf.projection[h];
                      const base = pr.covered + pr.uncovered;
                      return (
                        <tr key={h}>
                          <td>{h === "30d" ? "30 dias" : h === "90d" ? "90 dias" : "180 dias"}</td>
                          <td className="num text-right font-semibold">{fmtMoney(pr.central)}<div className="text-[10px] font-normal"><Change v={pf.total ? pr.central / pf.total - 1 : null} /></div></td>
                          <td className="num text-right text-xs text-muted">{fmtMoney(pr.low, "BRL", "pt", 0)} – {fmtMoney(pr.high, "BRL", "pt", 0)}</td>
                          <td className="num text-right text-xs">{base ? fmtPct(pr.covered / base, 0, false) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-muted">
                  Posições sem previsão válida (ações, fundos, commodities com fonte desatualizada) são mantidas constantes na projeção — veja a coluna “coberto”. A faixa soma os extremos de cada ativo (supõe movimentos na mesma direção) e não é um intervalo de confiança. Projeções são estimativas estatísticas, não garantia de retorno.
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
