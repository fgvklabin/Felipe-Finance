import { PageHeader, Disclaimer } from "@/components/ui";
import { AlertsManager } from "@/components/AlertsManager";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getCatalog, getCompanies, getFunds } from "@/lib/market";

export const metadata = { title: "Alertas" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ type?: string; ref?: string }> }) {
  const user = await requireUser("/alertas");
  const sp = await searchParams;
  const [alerts, notifications] = await Promise.all([
    query("SELECT id, alert_type, item_type, item_ref, threshold, channels, active, last_triggered_at FROM alerts WHERE user_id = $1 ORDER BY created_at DESC", [user.id]),
    query("SELECT id, title, body, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [user.id]),
  ]);
  const cat = getCatalog();
  const options = [
    ...cat.instruments.filter((i) => i.dataMode === "real").map((i) => ({ type: "commodity", ref: i.id, label: i.name.pt })),
    ...cat.currencies.filter((c) => c.dataMode === "real").map((c) => ({ type: "currency", ref: c.id, label: c.pair })),
    ...getCompanies().companies.flatMap((c) => c.tickersGiven.map((t) => ({ type: "company", ref: t, label: `${t} — ${c.name}` }))),
    ...getFunds().funds.slice(0, 250).map((f) => ({ type: "fund", ref: f.cnpjDigits, label: f.name.slice(0, 70) })),
  ];
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Pessoal" title="Alertas" subtitle="Avisamos quando algo importante acontecer: preço passou do seu alvo, variação forte, previsão mudou ou chegou cotação nova." />
      <AlertsManager alerts={alerts as never} notifications={notifications as never} options={options} prefill={sp} />
      <Disclaimer>Os alertas são verificados quando você clica em “Verificar agora” e diariamente pelo agendador. Commodities do Banco Mundial mudam uma vez por mês; câmbio, em dias úteis.</Disclaimer>
    </div>
  );
}
