import Link from "next/link";
import { Badge } from "./ui";
import { Change } from "./market/bits";
import { EXPOSURE_LABEL, TAG_LABEL, type FundBeneficiary, type StockBeneficiary } from "@/lib/beneficiaries";
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

export function FundList({ funds, limit = 30 }: { funds: FundBeneficiary[]; limit?: number }) {
  const main = funds.filter((f) => f.basis !== "nao_verificada");
  const other = funds.filter((f) => f.basis === "nao_verificada");
  const table = (rows: FundBeneficiary[]) => (
    <div className="overflow-x-auto">
      <table className="fin-table w-full min-w-[760px] text-[12.5px]">
        <thead><tr><th className="text-left">Fundo</th><th className="text-left">Exposição</th><th className="text-left">Tema</th><th className="text-right">Patrimônio</th><th className="text-right">12 meses</th><th className="text-right">Vol. 12m</th><th className="text-left">Gestor</th></tr></thead>
        <tbody>
          {rows.slice(0, limit).map(({ fund: f, matchedTags }) => (
            <tr key={f.cnpjDigits}>
              <td className="max-w-[320px]"><Link href={`/fundos/${f.cnpjDigits}`} className="block truncate font-medium hover:text-blue" title={f.name}>{f.name}</Link><div className="num text-[10.5px] text-muted">{f.cnpj}</div></td>
              <td><Badge tone={EXPOSURE_LABEL[f.exposureType]?.tone}>{EXPOSURE_LABEL[f.exposureType]?.label}</Badge></td>
              <td className="text-xs">{matchedTags.map((t) => TAG_LABEL[t] ?? t).join(", ")}</td>
              <td className="num text-right">{fmtCompact(f.performance?.netAssetsDaily ?? f.netAssets)}</td>
              <td className="text-right">{f.performance ? <Change v={f.performance.return12m} /> : <span className="text-xs text-muted">sem cota CVM</span>}</td>
              <td className="num text-right">{fmtPct(f.performance?.volatility12m ?? null, 1, false)}</td>
              <td className="max-w-[180px] truncate text-xs" title={f.manager ?? ""}>{f.manager ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-3">
      {main.length ? table(main) : <p className="text-sm text-muted">Nenhum fundo de índice ou de ações com este tema no cadastro da CVM.</p>}
      {other.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-[12.5px] font-medium">Multimercados com o tema no nome ({other.length}) — exposição não verificada</summary>
          <p className="my-2 text-[11.5px] text-muted">Podem estar comprados, vendidos, protegidos (hedge) ou alavancados no ativo; sem análise da carteira (CDA) não é possível afirmar que sobem com a commodity.</p>
          {table(other)}
        </details>
      )}
    </div>
  );
}
