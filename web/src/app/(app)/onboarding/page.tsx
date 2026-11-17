import { Card, CardBody, PageHeader } from "@/components/ui";
import { Onboarding } from "@/components/auth/Onboarding";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/market";

export const metadata = { title: "Boas-vindas" };

export default async function OnboardingPage() {
  const u = await requireUser("/onboarding");
  const cat = getCatalog();
  const options = [
    ...cat.instruments.map((i) => ({ id: i.id, label: i.name.pt, category: i.category, demo: i.dataMode === "demo" })),
    ...(u.account_type === "investor" ? cat.currencies.filter((c) => c.dataMode === "real").map((c) => ({ id: c.id, label: c.pair, category: "moedas", demo: false })) : []),
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Boas-vindas" title={`Olá, ${u.name.split(" ")[0]}!`} subtitle="Personalize sua experiência em um passo. Tudo pode ser alterado depois." />
      <Card><CardBody><Onboarding accountType={u.account_type} options={options} /></CardBody></Card>
    </div>
  );
}
