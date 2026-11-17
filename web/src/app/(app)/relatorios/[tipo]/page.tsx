import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, Disclaimer, PageHeader } from "@/components/ui";
import { Change } from "@/components/market/bits";
import { Markdown } from "@/components/ai/Markdown";
import { ShareCard } from "@/components/news/ShareCard";
import { PrintButton } from "@/components/PrintButton";
import { dailySummary, latestMacro } from "@/lib/insights";
import { getCatalog, getSummary } from "@/lib/market";
import { toRows } from "@/lib/rows";
import { fmtDate, fmtDateTime, fmtNumber, fmtPrice } from "@/lib/format";

export default async function ReportPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (tipo !== "diario" && tipo !== "semanal") notFound();
  const rows = toRows(getSummary().items, getCatalog()).filter((r) => r.dataMode === "real");
  const fx = rows.filter((r) => r.type === "currency");
  const com = rows.filter((r) => r.type === "instrument");
  const key = tipo === "diario" ? "d1" : "w1";
  const sum = dailySummary();
  const macro = latestMacro();
  const movers = [...com].sort((a, b) => Math.abs(b.m1 ?? 0) - Math.abs(a.m1 ?? 0)).slice(0, 8);
  const title = tipo === "diario" ? "Relatório diário de mercado" : "Relatório semanal de mercado";
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Relatórios Avermont" title={title} subtitle={`Gerado a partir do snapshot de ${fmtDateTime(getSummary().generatedAt)} · dados reais apenas`} right={<PrintButton />} />
      <Card>
        <CardHeader title="Destaques" />
        <CardBody><ul className="space-y-2">{sum.bullets.map((b, i) => <li key={i}><Markdown text={b} /></li>)}</ul></CardBody>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Câmbio — variação ${tipo === "diario" ? "do dia" : "da semana"}`} />
          <table className="fin-table w-full text-[13px]">
            <tbody>{fx.map((r) => <tr key={r.id}><td><Link href={r.href}>{r.name}</Link></td><td className="num text-right">{fmtNumber(r.last, 4)}</td><td className="text-right"><Change v={r[key]} digits={2} /></td><td className="num text-right text-xs text-muted">{fmtDate(r.lastDate)}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Commodities — maiores movimentos no último mês publicado" subtitle="Preços internacionais mensais (Banco Mundial)" />
          <table className="fin-table w-full text-[13px]">
            <tbody>{movers.map((r) => <tr key={r.id}><td><Link href={r.href}>{r.name}</Link></td><td className="num text-right">{fmtPrice(r.last)}</td><td className="text-xs text-muted">{r.unitLabel}</td><td className="text-right"><Change v={r.m1} /></td></tr>)}</tbody>
          </table>
        </Card>
      </div>
      <Card>
        <CardHeader title="Macro" />
        <CardBody className="text-[13px] text-fg-2">
          Selic {fmtNumber(macro.selic?.value, 2)}% · IPCA 12m {fmtNumber(macro.ipca12?.value, 2)}% · IBC-Br {fmtNumber(macro.ibc?.value, 2)} ({fmtDate(macro.ibc?.date, "pt", { month: "short", year: "numeric", timeZone: "UTC" })}).
          <div className="mt-3"><ShareCard title={title} summary={sum.bullets[0]?.replace(/\*\*/g, "") ?? ""} source="BCB, BCE, Banco Mundial" date={fmtDate(new Date().toISOString())} url={`/relatorios/${tipo}`} /></div>
        </CardBody>
      </Card>
      <Disclaimer />
    </div>
  );
}
