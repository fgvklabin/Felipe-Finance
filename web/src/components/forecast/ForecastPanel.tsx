import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { ForecastChart, type ForecastPoint } from "../charts/ForecastChart";
import { Badge, Card, CardBody, CardHeader, Notice } from "../ui";
import { fmtDate, fmtDateTime, fmtNumber, fmtPct, fmtPrice } from "@/lib/format";
import type { CatalogInstrument, ForecastResult, HorizonForecast } from "@/lib/market";
import { forecastSentence } from "@/lib/plain";

const HLABEL: Record<string, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", "180d": "180 dias", "12m": "12 meses" };
const STATUS: Record<HorizonForecast["status"], { label: string; tone: "green" | "gold" | "neutral" | "red" }> = {
  ok: { label: "Publicada", tone: "green" },
  expired: { label: "Expirada", tone: "gold" },
  insufficient_data: { label: "Dados insuficientes", tone: "neutral" },
  frequency_mismatch: { label: "Frequência incompatível", tone: "neutral" },
  not_justified: { label: "Não justificada", tone: "neutral" },
};
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function ForecastPanel({ fc, history, inst, unitLabel }: { fc: ForecastResult | undefined; history: [string, number][]; inst?: CatalogInstrument | null; unitLabel: string }) {
  if (!fc) {
    return (
      <Card>
        <CardHeader title="Avermont Forecast Engine" accent="var(--blue)" />
        <CardBody><Notice tone="gold">Dados insuficientes para uma previsão confiável. Esta série não é modelada (dados demonstrativos ou sem fonte integrada).</Notice></CardBody>
      </Card>
    );
  }
  const entries = Object.entries(fc.horizons).sort((a, b) => Object.keys(HLABEL).indexOf(a[0]) - Object.keys(HLABEL).indexOf(b[0]));
  const plotted: ForecastPoint[] = entries
    .filter(([, h]) => (h.status === "ok" || h.status === "expired") && h.central !== undefined)
    .map(([lb, h]) => ({ date: h.targetDate!, central: h.central!, low: h.low!, high: h.high!, label: HLABEL[lb] }));
  const anyExpired = entries.some(([, h]) => h.status === "expired");
  const recentHistory = history.slice(fc.frequency === "daily" ? -260 : -60);
  const s = fc.signals;
  return (
    <Card id="previsao">
      <CardHeader
        title="Previsão"
        subtitle={`Calculada em ${fmtDateTime(fc.generatedAt)} a partir do preço de ${fmtDate(fc.origin.date)} (${fmtPrice(fc.origin.value)} ${unitLabel})`}
        accent="var(--blue)"
        right={<Badge tone="blue">Estatística · sem LLM</Badge>}
      />
      <CardBody className="space-y-4">
        <p className="text-[15px] text-fg">{forecastSentence(fc, unitLabel)}</p>
        {anyExpired && (
          <Notice tone="gold" title="Fonte desatualizada">
            Parte dos horizontes já transcorreu porque a fonte não publicou dados mais recentes. As previsões expiradas aparecem no gráfico apenas para auditoria e não devem ser usadas para decisões.
          </Notice>
        )}
        {plotted.length > 0 && <ForecastChart history={recentHistory} forecasts={plotted} />}
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[860px] text-[13px]">
            <thead>
              <tr>
                <th className="text-left">Horizonte</th><th className="text-left">Status</th><th className="text-right">Central</th>
                <th className="text-right">Cenário baixo</th><th className="text-right">Cenário alto</th><th className="text-right">Variação esperada</th>
                <th className="text-left">Modelo publicado</th><th className="text-right">Ganho vs. naive</th><th className="text-right">Cobertura 80%</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([lb, h]) => (
                <tr key={lb} className={h.status === "expired" ? "opacity-60" : ""}>
                  <td className="font-medium">{HLABEL[lb]}{h.targetDate && <div className="text-[10px] text-muted">alvo {fmtDate(h.targetDate)}</div>}</td>
                  <td><Badge tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Badge></td>
                  {h.central !== undefined ? (
                    <>
                      <td className="num text-right font-semibold">{fmtPrice(h.central)}</td>
                      <td className="num text-right text-down">{fmtPrice(h.low)}</td>
                      <td className="num text-right text-up">{fmtPrice(h.high)}</td>
                      <td className="num text-right">{fmtPct(h.expectedChange)}</td>
                      <td className="text-xs">{h.modelLabel}</td>
                      <td className="num text-right text-xs">{h.beatsBaseline ? <span className="text-up">{fmtPct(h.skillVsNaive)} (p={fmtNumber(h.dieboldMarianoP ?? null, 3)})</span> : <span className="text-muted">não significativo</span>}</td>
                      <td className="num text-right text-xs">{fmtPct(h.evaluation?.intervalCoverage ?? null, 0, false)}</td>
                    </>
                  ) : (
                    <td colSpan={7} className="text-xs text-muted">
                      <span className="font-medium text-fg-2">{h.message}</span> {h.reason && <span>({h.reason})</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entries.some(([, h]) => h.fallbackNote) && (
          <div className="space-y-1">
            {entries.filter(([, h]) => h.fallbackNote && h.status !== "insufficient_data").map(([lb, h]) => (
              <div key={lb} className="flex gap-2 text-[11.5px] text-fg-2"><Info size={13} className="mt-0.5 shrink-0 text-blue" /><span><b>{HLABEL[lb]}:</b> {h.fallbackNote}</span></div>
            ))}
          </div>
        )}
        {entries.some(([, h]) => h.intervalWarning && h.status === "ok") && (
          <div className="space-y-1">
            {entries.filter(([, h]) => h.intervalWarning && h.status === "ok").map(([lb, h]) => (
              <div key={lb} className="flex gap-2 text-[11.5px] text-gold"><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span><b>{HLABEL[lb]}:</b> {h.intervalWarning}</span></div>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sinais quantitativos (descritivos)</div>
            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between"><dt className="text-fg-2">Momento 3 {fc.frequency === "daily" ? "meses (63 pregões)" : "meses"}</dt><dd className="num">{fmtPct(s.momentum3)}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-2">Momento 12 meses</dt><dd className="num">{fmtPct(s.momentum12 ?? null)}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-2">Volatilidade recente (anual.)</dt><dd className="num">{fmtPct(s.volRecent ?? null, 1, false)}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-2">Volatilidade 5 anos (anual.)</dt><dd className="num">{fmtPct(s.volLongRun ?? null, 1, false)}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-muted">Sinais descrevem o comportamento recente; não são previsões.</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Principais vetores de preço</div>
            {inst ? (
              <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-fg-2">{inst.fundamentals.drivers.map((d) => <li key={d}>{d}</li>)}</ul>
            ) : <p className="text-xs text-muted">Ver relação com commodities e juros na seção de moeda.</p>}
            <p className="mt-2 text-[11px] text-muted">Vetores fundamentais qualitativos — <b>não</b> entram no modelo univariado desta versão (roadmap: modelos com variáveis exógenas).</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Riscos</div>
            <div className="text-[12.5px] text-fg-2">
              <div className="font-medium text-up">Para cima</div>
              <p className="mb-1.5">{inst ? `${inst.fundamentals.weather} ${inst.fundamentals.geopolitics}` : "Choques de risco-país e aversão global a risco."}</p>
              <div className="font-medium text-down">Para baixo</div>
              <p>{inst ? `Oferta maior que o esperado, demanda mais fraca (${inst.fundamentals.consumers[0]}) e moeda.` : "Melhora fiscal, entrada de fluxo e diferencial de juros."}</p>
            </div>
          </div>
        </div>

        {s.seasonality && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sazonalidade histórica (retorno médio por mês, últimos 15 anos)</div>
            <div className="grid grid-cols-12 items-end gap-1" style={{ height: 90 }}>
              {s.seasonality.map((m) => {
                const h = Math.min(40, Math.abs(m.meanReturn) * 800);
                return (
                  <div key={m.month} className="flex h-full flex-col items-center justify-center" title={`${MONTHS[m.month - 1]}: ${fmtPct(m.meanReturn)} (desvio ${fmtPct(m.std, 1, false)}, n=${m.n})`}>
                    <div className="flex h-10 w-full items-end justify-center">{m.meanReturn > 0 && <div className="w-3/5 rounded-t bg-up/70" style={{ height: h }} />}</div>
                    <div className="h-px w-full bg-line" />
                    <div className="flex h-10 w-full items-start justify-center">{m.meanReturn < 0 && <div className="w-3/5 rounded-b bg-down/70" style={{ height: h }} />}</div>
                    <div className="text-[9px] text-muted">{MONTHS[m.month - 1]}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted">Médias com desvio-padrão alto: padrões sazonais em preços internacionais costumam ser fracos e instáveis.</p>
          </div>
        )}

        <details className="rounded-lg border border-line p-3 text-[12.5px] text-fg-2">
          <summary className="cursor-pointer font-medium text-fg"><CheckCircle2 size={14} className="mr-1 inline text-brand" />Metodologia e avaliação do modelo</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Modelos candidatos:</b> {fc.method.candidates?.join("; ")}.</li>
            <li><b>Validação:</b> {fc.method.validation}. Janela de estimação: {fc.method.window} observações.</li>
            <li><b>Intervalos:</b> {fc.method.interval}. A cobertura observada fora da amostra é reportada por horizonte.</li>
            <li><b>Regras de publicação:</b> horizontes sem histórico suficiente, com frequência incompatível ou cujo alvo já passou não são publicados. 12 meses exige ≥ 15 anos de dados e calibração aceitável.</li>
            <li><b>Sem vazamento:</b> em cada origem o modelo só usa dados até aquela data (testado automaticamente).</li>
          </ul>
          <div className="mt-3 overflow-x-auto">
            <table className="fin-table w-full min-w-[720px] text-xs">
              <thead><tr><th className="text-left">Horizonte</th><th className="text-right">Origens (seleção/avaliação)</th><th className="text-right">MAPE modelo</th><th className="text-right">MAPE naive</th><th className="text-right">RMSE (log)</th><th className="text-right">Acerto direcional</th></tr></thead>
              <tbody>
                {entries.filter(([, h]) => h.evaluation).map(([lb, h]) => (
                  <tr key={lb}>
                    <td>{HLABEL[lb]}</td>
                    <td className="num text-right">{h.evaluation!.selectionOrigins}/{h.evaluation!.evaluationOrigins}</td>
                    <td className="num text-right">{fmtPct(h.evaluation!.model?.mape ?? null, 2, false)}</td>
                    <td className="num text-right">{fmtPct(h.evaluation!.naive?.mape ?? null, 2, false)}</td>
                    <td className="num text-right">{fmtNumber(h.evaluation!.model?.rmseLog ?? null, 4)}</td>
                    <td className="num text-right">{h.evaluation!.model?.directionalAccuracy !== null && h.evaluation!.model?.directionalAccuracy !== undefined ? fmtPct(h.evaluation!.model.directionalAccuracy, 0, false) : "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-[11px] text-muted">Previsões são estimativas estatísticas com incerteza. Não há garantia de preços futuros. Cotações de contratos futuros (quando licenciadas) são exibidas separadamente em Curvas Futuras.</p>
      </CardBody>
    </Card>
  );
}
