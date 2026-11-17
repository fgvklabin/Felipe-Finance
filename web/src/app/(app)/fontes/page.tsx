import { Badge, Card, CardBody, CardHeader, Disclaimer, PageHeader } from "@/components/ui";
import { SOURCES } from "@/lib/sources-registry";
import { getIngestionLog } from "@/lib/market";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Fontes de Dados" };

const LIC: Record<string, { label: string; tone: "green" | "gold" | "red" | "blue" | "purple" | "neutral" }> = {
  open: { label: "Aberta", tone: "green" },
  open_with_attribution: { label: "Aberta c/ atribuição", tone: "green" },
  requires_license: { label: "Exige licença", tone: "red" },
  restricted: { label: "Restrita", tone: "gold" },
  derived: { label: "Derivada", tone: "blue" },
  demo: { label: "Demonstração", tone: "purple" },
};
const INT: Record<string, { label: string; tone: "green" | "gold" | "red" | "neutral" }> = {
  integrated: { label: "Integrada", tone: "green" }, planned: { label: "Planejada", tone: "gold" }, blocked: { label: "Bloqueada", tone: "red" }, not_planned: { label: "Fora do escopo", tone: "neutral" },
};

export default function SourcesPage() {
  const log = getIngestionLog().runs;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transparência"
        title="Central de fontes de dados"
        subtitle="Cada dado exibido identifica fonte, mercado, moeda, unidade, data, defasagem e status de verificação. Não fazemos scraping de sites restritos, não contornamos paywalls e não presumimos que preços visíveis publicamente podem ser redistribuídos."
      />
      <Card>
        <CardHeader title="Execuções de ingestão" subtitle="Status da última execução de cada conector (retentativas automáticas com backoff exponencial)" />
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[860px] text-[13px]">
            <thead><tr><th className="text-left">Conector</th><th>Status</th><th className="text-right">Registros</th><th>Última observação</th><th>Último sucesso</th><th className="text-right">Falhas seguidas</th><th className="text-left">Erro / aviso</th></tr></thead>
            <tbody>
              {Object.values(log).map((r) => (
                <tr key={r.source}>
                  <td className="font-mono text-xs">{r.source}</td>
                  <td className="text-center"><Badge tone={r.ok ? "green" : "red"}>{r.ok ? "OK" : "Falha"}</Badge></td>
                  <td className="num text-right">{r.rows.toLocaleString("pt-BR")}</td>
                  <td className="num text-xs">{fmtDate(r.latestObservation)}</td>
                  <td className="num text-xs">{fmtDateTime(r.lastSuccess)}</td>
                  <td className="num text-right">{r.consecutiveFailures}</td>
                  <td className="max-w-[360px] truncate text-xs text-muted" title={r.error ?? ""}>{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {SOURCES.map((s) => {
          const runs = (s.logKeys ?? []).map((k) => log[k]).filter(Boolean);
          const ok = runs.length ? runs.every((r) => r.ok) : null;
          return (
            <Card key={s.id}>
              <CardHeader
                title={s.provider}
                subtitle={s.dataset}
                right={<><Badge tone={LIC[s.licensing].tone}>{LIC[s.licensing].label}</Badge><Badge tone={INT[s.integration].tone}>{INT[s.integration].label}</Badge>{ok !== null && <Badge tone={ok ? "green" : "red"}>{ok ? "Ingestão OK" : "Falha recente"}</Badge>}</>}
              />
              <CardBody>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  {[
                    ["Categoria", s.category], ["API", s.api], ["Autenticação", s.auth], ["Frequência", s.frequency], ["Cobertura geográfica", s.geo],
                    ["Histórico", s.history], ["Moeda", s.currency], ["Unidade", s.unit], ["Licença", s.licenseNote], ["Qualidade", s.quality],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-[10.5px] uppercase tracking-wide text-muted">{k}</dt><dd className="text-fg-2">{v}</dd></div>
                  ))}
                  <div className="col-span-2"><dt className="text-[10.5px] uppercase tracking-wide text-muted">Limitações conhecidas</dt><dd className="text-fg-2">{s.limitations}</dd></div>
                  {runs.length > 0 && <div className="col-span-2"><dt className="text-[10.5px] uppercase tracking-wide text-muted">Última atualização bem-sucedida</dt><dd className="num text-fg-2">{runs.map((r) => fmtDateTime(r.lastSuccess)).join(" · ")}</dd></div>}
                  {s.url && <div className="col-span-2"><a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-blue underline">{s.url}</a></div>}
                </dl>
              </CardBody>
            </Card>
          );
        })}
      </div>
      <Disclaimer />
    </div>
  );
}
