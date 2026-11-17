import { Card, CardBody, PageHeader } from "@/components/ui";

export const metadata = { title: "Privacidade (LGPD)" };

export default function PrivacyPage() {
  const sections: [string, string][] = [
    ["Controlador e finalidade", "A Avermont trata dados pessoais para fornecer a plataforma (conta, preferências, watchlists, alertas, carteira simulada e assistente), garantir segurança e cumprir obrigações legais. Base legal: execução de contrato e legítimo interesse; consentimento para comunicações opcionais."],
    ["Dados comerciais das empresas", "Cotações de fornecedores, consumo, estoques, histórico de compras e conversas no contexto de um workspace são confidenciais. Ficam isolados por workspace, acessíveis apenas a membros autorizados, e nunca são usados para responder perguntas de outros clientes."],
    ["Inteligência artificial", "Perguntas à Avermont AI são processadas por um provedor de modelo de linguagem contratado, apenas com o contexto necessário à resposta. O histórico de conversas é armazenado na sua conta e pode ser excluído."],
    ["Seus direitos (art. 18 da LGPD)", "Confirmação e acesso, correção, anonimização, portabilidade, eliminação e revogação do consentimento. Em Configurações você pode exportar seus dados em JSON e excluir sua conta."],
    ["Retenção e segurança", "Senhas com hash bcrypt; sessões com token aleatório armazenado como hash; registros de auditoria imutáveis; criptografia em trânsito (HTTPS). Dados são mantidos enquanto a conta estiver ativa ou conforme obrigação legal."],
    ["Contato do encarregado (DPO)", "Configure o contato do encarregado na variável PRIVACY_CONTACT_EMAIL antes da operação comercial."],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="LGPD" title="Política de privacidade" subtitle="Versão inicial (MVP) — revise com assessoria jurídica antes do lançamento comercial." />
      <Card><CardBody className="space-y-4 text-sm text-fg-2">{sections.map(([t, b]) => <div key={t}><h2 className="mb-1 font-semibold text-fg">{t}</h2><p>{b}</p></div>)}</CardBody></Card>
    </div>
  );
}
