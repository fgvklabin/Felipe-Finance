import Link from "next/link";
import { Badge, Card, CardBody, CardHeader, Notice, PageHeader, Stat } from "@/components/ui";
import { FeedbackStatus, UserActions, VerificationReview } from "@/components/AdminActions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { getForecasts, getFunds, getIngestionLog, getSummary } from "@/lib/market";
import { fmtDate, fmtDateTime, fmtPct } from "@/lib/format";

export const metadata = { title: "Administração" };

export default async function AdminPage() {
  await requireAdmin();
  const [users, counts, verif, errors, feedback, outbox, auditRows, usage] = await Promise.all([
    query<{ id: string; name: string; email: string; account_type: string; is_admin: boolean; status: string; created_at: string; last_login_at: string | null }>("SELECT id, name, email, account_type, is_admin, status, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 200"),
    query<{ k: string; n: number }>(`SELECT 'users' k, count(*)::int n FROM users WHERE status = 'active' UNION ALL SELECT 'workspaces', count(*)::int FROM workspaces UNION ALL SELECT 'quotes', count(*)::int FROM supplier_quotations UNION ALL SELECT 'rfqs', count(*)::int FROM purchase_requests UNION ALL SELECT 'ai7d', count(*)::int FROM ai_messages WHERE role = 'user' AND created_at > now() - interval '7 days' UNION ALL SELECT 'alerts', count(*)::int FROM alerts WHERE active UNION ALL SELECT 'portfolios', count(*)::int FROM portfolios`),
    query<{ id: string; supplier: string; evidence: string; created_at: string }>("SELECT r.id, s.name AS supplier, r.evidence, r.created_at FROM supplier_verification_requests r JOIN suppliers s ON s.id = r.supplier_id WHERE r.status = 'pending' ORDER BY r.created_at"),
    query<{ id: number; route: string; message: string; created_at: string }>("SELECT id, route, message, created_at FROM error_logs ORDER BY created_at DESC LIMIT 30"),
    query<{ id: number; message: string; rating: number | null; page: string | null; status: string; created_at: string }>("SELECT id, message, rating, page, status, created_at FROM feedback ORDER BY created_at DESC LIMIT 30"),
    query<{ to_email: string; subject: string; status: string; created_at: string }>("SELECT to_email, subject, status, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 20"),
    query<{ id: number; actor_user_id: string | null; action: string; entity_type: string; entity_id: string | null; created_at: string }>("SELECT id, actor_user_id, action, entity_type, entity_id, created_at FROM audit_logs ORDER BY id DESC LIMIT 40"),
    query<{ event: string; n: number }>("SELECT event, count(*)::int n FROM usage_events WHERE created_at > now() - interval '30 days' GROUP BY event ORDER BY n DESC LIMIT 10"),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.k, x.n]));
  const runs = Object.values(getIngestionLog().runs);
  const stale = getSummary().items.filter((i) => i.dataMode === "real" && i.stats?.stale);
  const fc = Object.values(getForecasts().forecasts);
  const hz = fc.flatMap((f) => Object.values(f.horizons));
  const cov = hz.map((h) => h.evaluation?.intervalCoverage).filter((v): v is number => typeof v === "number");
  const funds = getFunds();
  const byType = users.reduce<Record<string, number>>((a, u) => ((a[u.account_type] = (a[u.account_type] ?? 0) + 1), a), {});
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Administração" accent="var(--gold)" title="Painel administrativo" subtitle="Operação da plataforma. Ações administrativas ficam registradas na auditoria." />
      <Notice tone="blue">Preços históricos, previsões passadas e o log de auditoria são <b>imutáveis</b> no banco (gatilhos bloqueiam alteração e exclusão). Correções de dados de mercado entram como novas linhas, com motivo, pelo pipeline de ingestão — nunca por edição manual.</Notice>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[["Usuários ativos", c.users], ["Workspaces", c.workspaces], ["Cotações", c.quotes], ["Pedidos de cotação", c.rfqs], ["Perguntas à IA (7d)", c.ai7d], ["Alertas ativos", c.alerts], ["Carteiras", c.portfolios]].map(([l, v]) => <Card key={String(l)} className="p-3"><Stat label={l} value={v ?? 0} /></Card>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Fontes de dados e falhas de API" subtitle="Último resultado de cada conector" right={<Link href="/fontes" className="text-xs text-blue hover:underline">Registro de fontes →</Link>} />
          <table className="fin-table w-full text-[12.5px]">
            <tbody>{runs.map((r) => <tr key={r.source}><td className="font-mono text-xs">{r.source}</td><td><Badge tone={r.ok ? "green" : "red"}>{r.ok ? "ok" : `falha ×${r.consecutiveFailures}`}</Badge></td><td className="num text-xs">{fmtDateTime(r.lastSuccess)}</td><td className="max-w-[220px] truncate text-xs text-muted" title={r.error ?? ""}>{r.error ?? ""}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title={`Dados desatualizados (${stale.length})`} subtitle="Séries reais cuja última observação passou do prazo esperado" />
          <CardBody className="max-h-[300px] overflow-y-auto p-0">
            <table className="fin-table w-full text-[12.5px]"><tbody>{stale.map((s) => <tr key={s.id}><td>{s.name.pt}</td><td className="num text-xs">{fmtDate(s.stats.lastDate)}</td><td className="num text-xs text-muted">{s.stats.ageDays} dias</td></tr>)}</tbody></table>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Desempenho das previsões" right={<Link href="/previsoes" className="text-xs text-blue hover:underline">Detalhes →</Link>} />
          <CardBody className="space-y-1 text-[13px]">
            <div className="flex justify-between"><span>Séries modeladas</span><span className="num">{fc.length}</span></div>
            <div className="flex justify-between"><span>Horizontes publicados</span><span className="num">{hz.filter((h) => h.status === "ok").length}</span></div>
            <div className="flex justify-between"><span>Com ganho significativo</span><span className="num">{hz.filter((h) => h.beatsBaseline).length}</span></div>
            <div className="flex justify-between"><span>Cobertura média do intervalo</span><span className="num">{fmtPct(cov.reduce((a, b) => a + b, 0) / (cov.length || 1), 0, false)}</span></div>
            <div className="flex justify-between"><span>Gerado em</span><span className="num text-xs">{fmtDateTime(getForecasts().generatedAt)}</span></div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Fundos (CVM)" />
          <CardBody className="space-y-1 text-[13px]">
            <div className="flex justify-between"><span>Fundos catalogados</span><span className="num">{funds.funds.length}</span></div>
            <div className="flex justify-between"><span>Com cota diária</span><span className="num">{funds.funds.filter((f) => f.performance).length}</span></div>
            <div className="flex justify-between"><span>Com lâmina</span><span className="num">{funds.funds.filter((f) => f.documents).length}</span></div>
            <div className="flex justify-between"><span>Atualizado</span><span className="num text-xs">{fmtDateTime(funds.ingestedAt)}</span></div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Uso do produto (30 dias)" />
          <CardBody className="space-y-1 text-[13px]">
            {usage.length === 0 && <p className="text-muted">Sem eventos.</p>}
            {usage.map((u) => <div key={u.event} className="flex justify-between"><span className="font-mono text-xs">{u.event}</span><span className="num">{u.n}</span></div>)}
            <div className="pt-2 text-xs text-muted">Contas: {Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(" · ")}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={`Verificação de fornecedores (${verif.length} pendentes)`} />
        <CardBody className="space-y-2">
          {verif.length === 0 && <p className="text-sm text-muted">Nenhuma solicitação pendente.</p>}
          {verif.map((v) => <div key={v.id} className="rounded-lg border border-line p-3 text-[13px]"><div className="font-medium">{v.supplier} <span className="text-xs text-muted">· {fmtDateTime(v.created_at)}</span></div><p className="my-1 text-fg-2">{v.evidence}</p><VerificationReview id={v.id} /></div>)}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Usuários (${users.length})`} />
        <div className="overflow-x-auto">
          <table className="fin-table w-full min-w-[860px] text-[12.5px]">
            <thead><tr><th className="text-left">Nome</th><th className="text-left">E-mail</th><th>Tipo</th><th>Status</th><th>Criado</th><th>Último login</th><th /></tr></thead>
            <tbody>{users.map((u) => <tr key={u.id}><td>{u.name} {u.is_admin && <Badge tone="gold">admin</Badge>}</td><td className="text-xs">{u.email}</td><td className="text-center text-xs">{u.account_type}</td><td className="text-center"><Badge tone={u.status === "active" ? "green" : "neutral"}>{u.status}</Badge></td><td className="num text-xs">{fmtDate(u.created_at)}</td><td className="num text-xs">{fmtDateTime(u.last_login_at)}</td><td><UserActions id={u.id} isAdmin={u.is_admin} status={u.status} /></td></tr>)}</tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Erros da aplicação" />
          <CardBody className="max-h-[320px] overflow-y-auto p-0">
            <table className="fin-table w-full text-[12px]"><tbody>{errors.length === 0 ? <tr><td className="text-muted">Sem erros registrados.</td></tr> : errors.map((e) => <tr key={e.id}><td className="num text-xs">{fmtDateTime(e.created_at)}</td><td className="font-mono text-xs">{e.route}</td><td className="text-xs">{e.message}</td></tr>)}</tbody></table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Feedback dos usuários" />
          <CardBody className="max-h-[320px] space-y-2 overflow-y-auto">
            {feedback.length === 0 && <p className="text-sm text-muted">Sem feedback.</p>}
            {feedback.map((f) => <div key={f.id} className="flex items-start gap-2 rounded-lg border border-line p-2 text-[12.5px]"><div className="flex-1"><div>{f.message}</div><div className="text-[11px] text-muted">{fmtDateTime(f.created_at)} · {f.page} {f.rating ? `· nota ${f.rating}` : ""}</div></div><FeedbackStatus id={f.id} status={f.status} /></div>)}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Caixa de saída de e-mail" subtitle="“not_configured” = provedor de e-mail não configurado (RESEND_API_KEY)" />
          <table className="fin-table w-full text-[12px]"><tbody>{outbox.map((o, i) => <tr key={i}><td className="num text-xs">{fmtDateTime(o.created_at)}</td><td className="text-xs">{o.to_email}</td><td className="text-xs">{o.subject}</td><td><Badge tone={o.status === "sent" ? "green" : o.status === "failed" ? "red" : "neutral"}>{o.status}</Badge></td></tr>)}</tbody></table>
        </Card>
        <Card>
          <CardHeader title="Auditoria (imutável)" />
          <CardBody className="max-h-[320px] overflow-y-auto p-0">
            <table className="fin-table w-full text-[12px]"><tbody>{auditRows.map((a) => <tr key={a.id}><td className="num text-xs">{fmtDateTime(a.created_at)}</td><td className="font-mono text-xs">{a.action}</td><td className="text-xs text-muted">{a.entity_type}:{a.entity_id?.slice(0, 8)}</td><td className="text-xs text-muted">{a.actor_user_id?.slice(0, 8) ?? "sistema"}</td></tr>)}</tbody></table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
