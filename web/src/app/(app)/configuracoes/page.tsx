import { PageHeader } from "@/components/ui";
import { SettingsForms } from "@/components/SettingsForms";
import { requireUser } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser("/configuracoes");
  const prefs = await getPrefs();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Conta" title="Configurações" subtitle={`Conta ${user.account_type === "business" ? "empresarial" : user.account_type === "supplier" ? "de fornecedor" : "pessoal"} · ${user.email}`} />
      <SettingsForms user={{ name: user.name, email: user.email, locale: user.locale, notification_prefs: user.notification_prefs }} theme={prefs.theme} dataMode={prefs.dataMode} />
    </div>
  );
}
