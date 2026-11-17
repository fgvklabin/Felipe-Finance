import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Disclaimer, PageHeader, Stat, Summary } from "@/components/ui";
import { getCatalog, getForecastArchive, getForecasts, getSummaryItem } from "@/lib/market";
import { fmtDateTime, fmtNumber, fmtPct, fmtPrice } from "@/lib/format";

export const metadata = { title: "Previsões" };
const H = ["7d", "30d", "90d", "180d", "12m"] as const;
const TONE: Record<string, "green" | "gold" | "neutral"> = { ok: "green", expired: "gold" };
const SHORT: Record<string, string> = { ok: "OK", expired: "Expirada", insufficient_data: "Insuf.", frequency_mismatch: "n/a", not_justified: "Não justif." };

export default function ForecastsPage() {
  const { forecasts, generatedAt, engineVersion } = getForecasts();
  const cat = getCatalog();
  const all = Object.values(forecasts);
  const horizons = all.flatMap((f) => Object.entries(f.horizons).map(([lb, h]) => ({ id: f.id, lb, h })));
  const evaluated = horizons.filter((x) => x.h.evaluation);
  const ok = horizons.filter((x) => x.h.status === "ok");
  const beats = horizons.filter((x) => x.h.beatsBaseline);
  const candidatesBetter = evaluated.filter((x) => (x.h.candidateSkill ?? 0) > 0);
  const cov = evaluated.map((x) => x.h.evaluation!.intervalCoverage).filter((v): v is number => v !== null);
  const avgCov = cov.length ? cov.reduce((a, b) => a + b, 0) / cov.length : null;
  const archive = getForecastArchive().entries.slice(-10).reverse();
  const name = (id: string) => cat.instruments.find((i) => i.id === id)?.name.pt ?? cat.currencies.find((c) => c.id === id)?.pair ?? id;
  const href = (id: string) => (cat.currencies.some((c) => c.id === id) ? `/moedas/${id}#previsao` : `/commodity/${id}#previsao`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Avermont Forecast Engine"
        accent="var(--blue)"
        title="Previsões"
        subtitle="Para onde os preços podem ir — e com que confiança. Os números vêm de modelos estatísticos testados com dados do passado, nunca de chute."
        right={<span className="text-xs text-muted">Motor v{engineVersion} · {fmtDateTime(generatedAt)}</span>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="p-3"><Stat label="Mercados analisados" value={all.length} /></Card>
        <Card className="p-3"><Stat label="Previsões válidas hoje" value={ok.length} /></Card>
        <Card className="p-3"><Stat label="Com tendência confiável" value={beats.length} tone="text-up" /></Card>
        <Card className="p-3"><Stat label="Descartadas por cautela" value={candidatesBetter.length - beats.length} sub="melhora pequena demais" /></Card>
        <Card className="p-3"><Stat label="Acerto da faixa provável" value={fmtPct(avgCov, 0, false)} sub="em testes com dados passados" /></Card>
      </div>
      <Summary title="Como ler" items={[
        "Preços de commodities e dólar são muito difíceis de prever. Na maior parte do tempo, a melhor aposta é que fiquem perto do valor atual.",
        "Por isso, mostramos sempre uma faixa provável (onde o preço deve ficar na maioria das vezes), e não um número exato.",
        "Só dizemos “tendência de alta” ou “de baixa” quando o modelo provou, em testes com dados antigos, que acerta mais do que simplesmente repetir o preço atual.",
      ]} />
      <Card>
        <CardHeader title="Todas as previsões" subtitle="Clique no nome para ver o gráfico" />
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[1100px] text-[13px]">
            <thead>
              <tr>
                <th className="text-left">Série</th><th className="text-right">Último</th><th>Origem</th>
                {H.map((h) => <th key={h} className="text-center">{h}</th>)}
                <th className="text-right">Central 30d</th><th className="text-right">Faixa 30d</th><th className="text-left">Modelo 30d</th>
              </tr>
            </thead>
            <tbody>
              {all.map((f) => {
                const h30 = f.horizons["30d"];
                const stale = getSummaryItem(f.id)?.stats?.stale;
                return (
                  <tr key={f.id}>
                    <td><Link href={href(f.id)} className="font-medium hover:text-blue">{name(f.id)}</Link> {stale && <Badge tone="gold">fonte desatualizada</Badge>}</td>
                    <td className="num text-right">{fmtPrice(f.origin.value)}</td>
                    <td className="num text-xs text-muted">{f.origin.date}</td>
                    {H.map((h) => {
                      const x = f.horizons[h];
                      return <td key={h} className="text-center">{x ? <Badge tone={x.beatsBaseline ? "blue" : TONE[x.status] ?? "neutral"} title={x.message ?? x.fallbackNote ?? ""}>{x.beatsBaseline ? "Modelo ✓" : SHORT[x.status]}</Badge> : "—"}</td>;
                    })}
                    <td className="num text-right">{h30?.central !== undefined ? fmtPrice(h30.central) : "—"}</td>
                    <td className="num text-right text-xs text-muted">{h30?.low !== undefined ? `${fmtPrice(h30.low)} – ${fmtPrice(h30.high)}` : "—"}</td>
                    <td className="max-w-[220px] truncate text-xs">{h30?.modelLabel ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Avaliação fora da amostra — horizontes com ganho significativo" />
          <CardBody className="overflow-x-auto p-0">
            <table className="fin-table w-full text-[13px]">
              <thead><tr><th className="text-left">Série / horizonte</th><th className="text-left">Modelo</th><th className="text-right">Ganho (MAE)</th><th className="text-right">p (DM)</th><th className="text-right">Acerto direcional</th><th className="text-right">Status</th></tr></thead>
              <tbody>
                {beats.length === 0 && <tr><td colSpan={6} className="text-center text-sm text-muted">Nenhum horizonte com ganho significativo nesta execução.</td></tr>}
                {beats.map(({ id, lb, h }) => (
                  <tr key={id + lb}>
                    <td><Link href={href(id)} className="hover:text-blue">{name(id)}</Link> · {lb}</td>
                    <td className="text-xs">{h.modelLabel}</td>
                    <td className="num text-right text-up">{fmtPct(h.skillVsNaive)}</td>
                    <td className="num text-right">{fmtNumber(h.dieboldMarianoP ?? null, 3)}</td>
                    <td className="num text-right">{h.evaluation?.model?.directionalAccuracy != null ? fmtPct(h.evaluation.model.directionalAccuracy, 0, false) : "n/a"}</td>
                    <td className="text-right"><Badge tone={TONE[h.status] ?? "neutral"}>{SHORT[h.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck size={15} className="text-brand" /> Histórico imutável de previsões</span>} subtitle="Cada execução é arquivada com hash SHA-256 (append-only) para avaliação futura com dados realizados" />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
            <table className="fin-table w-full text-[12px]">
              <thead><tr><th className="text-left">Execução</th><th className="text-right">Séries</th><th className="text-left">SHA-256</th></tr></thead>
              <tbody>
                {archive.map((a) => (
                  <tr key={a.sha256}><td className="num">{fmtDateTime(a.generatedAt)}</td><td className="num text-right">{a.series}</td><td className="break-all font-mono text-[10.5px] text-muted" title={a.sha256}>{a.sha256.slice(0, 16)}…</td></tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="px-3 py-2 text-[11px] text-muted">A avaliação “ao vivo” (previsões passadas × preços realizados) acumula conforme novas edições das fontes são ingeridas. No banco de dados, previsões e preços históricos são protegidos por gatilhos que bloqueiam alterações.</p>
          </CardBody>
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
