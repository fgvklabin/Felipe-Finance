import { Card, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { QuoteRanking, type QuoteRow } from "@/components/business/QuoteRanking";
import { QuoteImporter } from "@/components/business/QuoteImporter";
import { RfqPanel } from "@/components/business/RfqPanel";
import { SupplierDirectory } from "@/components/business/SupplierDirectory";
import { NoWorkspace } from "@/components/business/NoWorkspace";
import { requireUser, roleAtLeast } from "@/lib/auth";
import { currentWorkspace, marketParams } from "@/lib/business";
import { query } from "@/lib/db";
import { getCatalog } from "@/lib/market";
import { fmtDate, fmtNumber } from "@/lib/format";

export const metadata = { title: "Comparador de Fornecedores" };

export default async function SuppliersPage() {
  const user = await requireUser("/business/fornecedores");
  const ws = await currentWorkspace(user);
  if (!ws) return <NoWorkspace />;
  const cat = getCatalog();
  const commodities = cat.instruments.map((i) => ({ id: i.id, label: i.name.pt }));
  const names = Object.fromEntries(commodities.map((c) => [c.id, c.label]));
  const [quotes, rfqs, suppliers] = await Promise.all([
    query<QuoteRow>("SELECT q.*, s.verification_status AS supplier_verification FROM supplier_quotations q LEFT JOIN suppliers s ON s.id = q.supplier_id WHERE q.workspace_id = $1 ORDER BY q.created_at DESC", [ws.workspace_id]),
    query("SELECT r.*, (SELECT count(*)::int FROM supplier_quotations q WHERE q.purchase_request_id = r.id) AS responses FROM purchase_requests r WHERE workspace_id = $1 ORDER BY created_at DESC", [ws.workspace_id]),
    query("SELECT * FROM suppliers WHERE private_to_workspace IS NULL OR private_to_workspace = $1 ORDER BY is_demo, name", [ws.workspace_id]),
  ]);
  const mp = marketParams();
  const canEdit = roleAtLeast(ws.role, "buyer");
  const selicLabel = mp.selicAnnual ? `Selic ${fmtNumber(mp.selicAnnual, 2)}% a.a. (${fmtDate(mp.selicDate)})` : "taxa indisponível";
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Avermont Business · ${ws.workspace_name}`}
        title="Comparador de fornecedores"
        subtitle="Ranking pelo custo total de aquisição (preço + frete + impostos + câmbio), com ajuste a valor presente pelo prazo de pagamento. Suas cotações são privadas ao seu workspace."
      />
      <Notice tone="blue">
        A Avermont não inventa cotações, disponibilidade, contatos ou status de verificação. Compare propostas reais que você recebeu — inclusive de fornecedores não cadastrados — e use o pedido de cotação para solicitar novas.
        Fornecedores <b>demonstrativos</b> (fictícios) aparecem apenas no diretório, identificados.
      </Notice>
      <Card>
        <CardHeader title="Ranking de propostas" subtitle={`${quotes.length} cotação(ões) · valor presente com ${selicLabel}`} accent="var(--brand)" />
        <QuoteRanking quotes={quotes} fx={mp.fx} rateMonthly={mp.rateMonthly} selicLabel={selicLabel} commodities={commodities} canEdit={canEdit} />
      </Card>
      {canEdit && (
        <Card>
          <CardHeader title="Adicionar cotações" subtitle="Manual, CSV, Excel ou PDF/imagem com extração assistida por IA — sempre com sua verificação" />
          <QuoteImporter commodities={commodities} />
        </Card>
      )}
      <Card>
        <CardHeader title="Pedidos de cotação (RFQ)" subtitle="Crie, compartilhe por e-mail/WhatsApp e receba respostas de fornecedores cadastrados" />
        <RfqPanel rfqs={rfqs as never} commodities={commodities} canEdit={canEdit} />
      </Card>
      <Card>
        <CardHeader title="Diretório de fornecedores" />
        <SupplierDirectory suppliers={suppliers as never} names={names} canEdit={canEdit} />
      </Card>
      <Disclaimer>Diferenças de custo são estimativas baseadas nos dados informados e em premissas explícitas (câmbio PTAX, Selic). Não representam economia garantida. Confirme condições comerciais, qualidade e confiabilidade com cada fornecedor.</Disclaimer>
    </div>
  );
}
