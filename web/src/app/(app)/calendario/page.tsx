import { Badge, Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { generateEvents } from "@/lib/calendar";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Calendário Econômico" };

const CAT_TONE: Record<string, "cyan" | "green" | "gold" | "blue"> = { moedas: "cyan", commodities: "green", macro: "gold", empresas: "blue" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ ptax?: string }> }) {
  const { ptax } = await searchParams;
  const user = await getCurrentUser();
  const gen = generateEvents(new Date(), 60).filter((e) => ptax === "1" || !e.id.startsWith("ptax-"));
  const custom = await query<{ id: string; title: string; starts_at: string; category: string; source_name: string | null; source_url: string | null; confirmed: boolean }>(
    "SELECT id, title, starts_at, category, source_name, source_url, confirmed FROM calendar_events WHERE starts_at >= now() - interval '1 day' ORDER BY starts_at LIMIT 100",
  ).catch(() => []);
  const all = [
    ...gen.map((e) => ({ id: e.id, date: e.date, time: e.time, title: e.title, category: e.category, source: e.source, url: e.url, confirmed: e.confirmed, rule: e.rule })),
    ...custom.map((c) => ({ id: c.id, date: new Date(c.starts_at).toISOString().slice(0, 10), time: undefined, title: c.title, category: c.category, source: c.source_name ?? "", url: c.source_url ?? undefined, confirmed: c.confirmed, rule: "Evento cadastrado com fonte" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map<string, typeof all>();
  all.forEach((e) => byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Agenda" title="Calendário econômico" subtitle="Publicações das fontes integradas e eventos cadastrados com fonte. Datas estimadas seguem a regra de publicação usual e devem ser confirmadas na fonte oficial." right={<a href={ptax === "1" ? "/calendario" : "/calendario?ptax=1"} className="text-xs text-blue underline">{ptax === "1" ? "Ocultar PTAX diária" : "Mostrar PTAX diária"}</a>} />
      <Notice tone="gold">Reuniões do Copom, relatórios WASDE/USDA e resultados trimestrais de empresas dependem de calendários oficiais que ainda não estão integrados; administradores podem cadastrá-los com o link da fonte.</Notice>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Próximos 60 dias" />
          <CardBody className="space-y-4">
            {[...byDay.entries()].map(([d, evs]) => (
              <div key={d} className="grid grid-cols-[110px_1fr] gap-3">
                <div className="num text-sm font-semibold">{fmtDate(d, "pt", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })}</div>
                <ul className="space-y-1.5">
                  {evs.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
                      {e.time && <span className="num text-xs text-muted">{e.time}</span>}
                      <span className="font-medium">{e.title}</span>
                      <Badge tone={CAT_TONE[e.category] ?? "neutral"}>{e.category}</Badge>
                      <Badge tone={e.confirmed ? "green" : "neutral"}>{e.confirmed ? "confirmado" : "estimado"}</Badge>
                      <span className="ml-auto text-[11px] text-muted" title={e.rule}>{e.url ? <a className="underline" href={e.url} target="_blank" rel="noopener noreferrer">{e.source}</a> : e.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cadastrar evento" subtitle="Somente administradores · exige link da fonte oficial" />
          <CardBody>{user?.is_admin ? <CalendarEventForm /> : <p className="text-sm text-muted">Disponível para administradores.</p>}</CardBody>
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
