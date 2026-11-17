import { Card, CardBody } from "../ui";

// Distinção explícita entre tipos de preço exibidos na plataforma.
export function PriceTypeLegend() {
  const items = [
    { color: "#10B981", title: "Benchmark internacional", body: "Preço de referência publicado por fonte oficial (ex.: Banco Mundial, média mensal). Não inclui frete, prêmio ou impostos no Brasil." },
    { color: "#06B6D4", title: "Preço físico regional", body: "Preço praticado em uma praça (ex.: CEPEA, Consecana). Exige licença para redistribuição — exibido como DEMO quando não licenciado." },
    { color: "#3B82F6", title: "Contrato futuro", body: "Cotação de bolsa (B3, CME, ICE, LME) para um vencimento. Expectativa precificada pelo mercado, não garantia de preço spot." },
    { color: "#8B5CF6", title: "Previsão Avermont", body: "Estimativa estatística validada fora da amostra, com intervalo de incerteza. Separada das cotações." },
    { color: "#F59E0B", title: "Cotação de fornecedor", body: "Proposta comercial recebida pela sua empresa (Avermont Business). Privada ao seu workspace e verificada por você." },
  ];
  return (
    <Card>
      <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((i) => (
          <div key={i.title} className="text-[12px]">
            <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-fg"><span className="h-2 w-2 rounded-full" style={{ background: i.color }} />{i.title}</div>
            <p className="text-muted">{i.body}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
