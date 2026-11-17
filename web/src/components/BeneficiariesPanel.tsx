import Link from "next/link";
import { Badge } from "./ui";
import { Change } from "./market/bits";
import type { FundBeneficiary, StockBeneficiary } from "@/lib/beneficiaries";
import { BASIS_LABEL, exposureText } from "@/lib/fund-exposure";
import type { Fund } from "@/lib/market";
import { fmtCompact, fmtPct } from "@/lib/format";

export function StockList({ stocks }: { stocks: StockBeneficiary[] }) {
  if (!stocks.length) return <p className="text-sm text-muted">Nenhuma companhia do universo coberto tem receita relevante ligada a esta commodity.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {stocks.map((s) => {
        const f = s.company?.financials.at(-1);
        return (
          <div key={s.ticker} className="rounded-lg border border-line p-3 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/empresas/${s.ticker}`} className="text-sm font-semibold text-blue hover:underline">{s.tickers.join(" / ")}</Link>
              <span className="font-medium">{s.name}</span>
              <Badge tone={s.strength === "direta" ? "green" : "gold"}>{s.strength === "direta" ? "ganha com a alta" : "efeito misto"}</Badge>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{s.sector}{f?.revenue ? ` · receita ${f.fiscalYear}: ${fmtCompact(f.revenue)} · margem EBITDA calc. ${fmtPct(f.ebitdaCalculatedMargin ?? null, 1, false)}` : ""}</div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-fg-2">{s.channels.map((c) => <li key={c}>{c}</li>)}</ul>
            {s.offsets.length > 0 && <p className="mt-1.5 text-[11.5px] text-muted"><b>Mas pode não subir porque:</b> {s.offsets.join("; ")}.</p>}
          </div>
        );
      })}
    </div>
  );
}

export function FundList({ funds, nameOnly = [], limit = 30 }: { funds: FundBeneficiary[]; nameOnly?: Fund[]; limit?: number }) {
  const main = funds.filter((f) => f.exposure.basis !== "nao_verificada");
  const other = funds.filter((f) => f.exposure.basis === "nao_verificada");
  const table = (rows: FundBeneficiary[]) => (
    <div className="overflow-x-auto">
      <table className="fin-table w-full min-w-[720px] text-[12.5px]">
        <thead><tr><th className="text-left">Fundo</th><th className="text-left">Quanto tem da commodity</th><th className="text-right">Patrimônio</th><th className="text-right">12 meses</th><th className="text-left">Gestor</th></tr></thead>
        <tbody>
          {rows.slice(0, limit).map(({ fund: f, exposure: e }) => (
            <tr key={f.cnpjDigits}>
              <td className="max-w-[300px]"><Link href={`/fundos/${f.cnpjDigits}`} className="block truncate font-medium hover:text-blue" title={f.name}>{f.name}</Link><div className="num text-[10.5px] text-muted">{f.cnpj}</div></td>
              <td className="max-w-[300px]">
                <Badge tone={BASIS_LABEL[e.basis].tone}>{BASIS_LABEL[e.basis].label}</Badge>
                <div className="mt-0.5 text-[11.5px] text-fg-2">{exposureText(e)}</div>
              </td>
              <td className="num text-right">{fmtCompact(f.performance?.netAssetsDaily ?? f.netAssets)}</td>
              <td className="text-right">{f.performance ? <Change v={f.performance.return12m} /> : <span className="text-xs text-muted">sem cota CVM</span>}</td>
              <td className="max-w-[160px] truncate text-xs" title={f.manager ?? ""}>{f.manager ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-3">
      {main.length ? table(main) : <p className="text-sm text-muted">Nenhum fundo com exposição verificada ou fundo de índice/ações com este tema.</p>}
      <p className="text-[11.5px] text-muted">
        &quot;Verificada na carteira&quot; = o fundo declarou à CVM (CDA mensal) que tinha esses ativos naquele mês. A carteira muda; posições de até 90 dias podem ficar confidenciais.
      </p>
      {other.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-[12.5px] font-medium">Multimercados com o tema no nome ({other.length}) — sem carteira verificada</summary>
          <p className="my-2 text-[11.5px] text-muted">Podem estar comprados, vendidos, protegidos (hedge) ou alavancados; sem a carteira não dá para dizer que sobem com a commodity.</p>
          {table(other)}
        </details>
      )}
      {nameOnly.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-[12.5px] font-medium">Têm o tema no nome, mas a carteira não mostra exposição relevante ({nameOnly.length})</summary>
          <p className="my-2 text-[11.5px] text-muted">Na última carteira divulgada, menos de 5% do patrimônio estava ligado a esta commodity (ou a posição era vendida).</p>
          <ul className="space-y-1 text-[12.5px]">
            {nameOnly.slice(0, limit).map((f) => (
              <li key={f.cnpjDigits}><Link href={`/fundos/${f.cnpjDigits}`} className="hover:text-blue">{f.name}</Link> <span className="text-[11px] text-muted">carteira de {f.holdings?.month}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
