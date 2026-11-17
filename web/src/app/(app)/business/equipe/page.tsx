import { Card, CardBody, CardHeader, PageHeader, Badge } from "@/components/ui";
import { TeamManager } from "@/components/business/TeamManager";
import { NoWorkspace } from "@/components/business/NoWorkspace";
import { requireUser, roleAtLeast } from "@/lib/auth";
import { currentWorkspace } from "@/lib/business";
import { query } from "@/lib/db";

export const metadata = { title: "Equipe" };

export default async function TeamPage() {
  const user = await requireUser("/business/equipe");
  const ws = await currentWorkspace(user);
  if (!ws) return <NoWorkspace />;
  const [members, invites] = await Promise.all([
    query<{ id: string; name: string; email: string; role: string }>("SELECT u.id, u.name, u.email, m.role FROM workspace_members m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 ORDER BY m.created_at", [ws.workspace_id]),
    query<{ id: string; email: string; role: string; accepted_at: string | null }>("SELECT id, email, role, accepted_at FROM workspace_invites WHERE workspace_id = $1 AND accepted_at IS NULL ORDER BY created_at DESC", [ws.workspace_id]),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader eyebrow="Avermont Business" title={`Equipe — ${ws.workspace_name}`} subtitle="Papéis: proprietário e administrador gerenciam membros; comprador edita materiais, cotações e compras; leitor apenas consulta." />
      <Card>
        <CardHeader title="Membros" />
        <CardBody className="p-0">
          <table className="fin-table w-full text-[13px]">
            <tbody>{members.map((m) => <tr key={m.id}><td className="font-medium">{m.name}</td><td className="text-muted">{m.email}</td><td><Badge tone={m.role === "owner" ? "gold" : "blue"}>{m.role}</Badge></td></tr>)}</tbody>
          </table>
          {invites.length > 0 && <div className="px-3 py-2 text-xs text-muted">Convites pendentes: {invites.map((i) => `${i.email} (${i.role})`).join(", ")} — aceitos automaticamente quando a pessoa criar conta com este e-mail.</div>}
        </CardBody>
      </Card>
      {roleAtLeast(ws.role, "admin") && (
        <Card>
          <CardHeader title="Convidar membro" />
          <CardBody><TeamManager members={members} selfId={user.id} /></CardBody>
        </Card>
      )}
    </div>
  );
}
