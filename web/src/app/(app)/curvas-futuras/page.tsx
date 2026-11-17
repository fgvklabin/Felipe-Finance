import Link from "next/link";
import { Card, CardBody, CardHeader, Disclaimer, Notice, PageHeader } from "@/components/ui";
import { CurveAnalyzer } from "@/components/futures/CurveAnalyzer";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { getForecasts, getMacro, getSeries, getSummaryItem } from "@/lib/market";
import { fmtDate, fmtNumber, fmtPrice } from "@/lib/format";

export const metadata = { title: "Curvas Futuras" };

export default function FuturesPage() {
  const usd = getSeries("usdbrl");
  const usdItem = getSummaryItem("usdbrl");
  const fc = getForecasts().forecasts["usdbrl"];
  const focus = getMacro().focus;
  const fcPoints = fc ? Object.entries(fc.horizons).filter(([, h]) => h.status === "ok").map(([lb, h]) => ({ date: h.targetDate!, central: h.central!, low: h.low!, high: h.high!, label: lb })) : [];
  const focusFx = (focus?.items ?? []).filter((i) => i.Indicador === "Câmbio").sort((a, b) => a.DataReferencia.localeCompare(b.DataReferencia)).slice(0, 3);
  const focusPts = focusFx.map((i) => ({ date: `${i.DataReferencia}-12-31`, value: i.Mediana }));
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Derivativos"
        accent="var(--blue)"
        title="Curvas futuras"
        subtitle="Estrutura a termo, contango/backwardation e base contra o físico. A plataforma separa três coisas diferentes: (1) cotações de contratos futuros, (2) previsões estatísticas da Avermont e (3) preços físicos de referência."
      />
      <Notice tone="gold" title="Cotações de contratos futuros exigem licença">
        Ajustes, volume e contratos em aberto de B3, CME/CBOT, ICE e LME são dados licenciados. Esta implantação <b>não</b> possui licença de redistribuição, portanto não exibe curvas reais de bolsa.
        Você pode analisar uma curva inserindo os ajustes a que tem acesso, e a integração oficial está prevista no roadmap (ver <Link href="/fontes" className="underline">Fontes</Link>).
      </Notice>

      <Card>
        <CardHeader title="Dólar/Real: três referências lado a lado" subtitle="Dados reais — PTAX (físico/spot), Focus (expectativa de mercado) e Avermont Forecast Engine (estatística)" accent="#38BDF8" />
        <CardBody>
          <div className="mb-3 grid gap-3 md:grid-cols-3 text-[12.5px]">
            <div className="rounded-lg border border-emerald-500/30 p-3"><div className="font-semibold text-emerald-500">1. Preço de referência (spot)</div><div className="num text-lg font-semibold">R$ {fmtNumber(usdItem?.stats?.last, 4)}</div><div className="text-muted">PTAX venda de {fmtDate(usdItem?.stats?.lastDate)} · BCB</div></div>
            <div className="rounded-lg border border-cyan-500/30 p-3"><div className="font-semibold text-cyan-500">2. Expectativa de mercado (Focus)</div>{focusFx.map((i) => <div key={i.DataReferencia} className="num">fim de {i.DataReferencia}: R$ {fmtPrice(i.Mediana)} <span className="text-[11px] text-muted">({i.numeroRespondentes} resp.)</span></div>)}<div className="text-muted">Pesquisa de {fmtDate(focus?.date)} · não é preço negociável</div></div>
            <div className="rounded-lg border border-blue-500/30 p-3"><div className="font-semibold text-blue">3. Previsão Avermont</div>{fcPoints.map((p) => <div key={p.label} className="num">{p.label}: R$ {fmtPrice(p.central)} <span className="text-[11px] text-muted">({fmtPrice(p.low)}–{fmtPrice(p.high)})</span></div>)}<div className="text-muted">Passeio aleatório publicado quando nenhum modelo o supera</div></div>
          </div>
          {usd && <ForecastChart history={usd.points.slice(-500)} forecasts={fcPoints} extra={[{ label: "Focus (mediana fim de ano)", points: focusPts, color: "#06B6D4" }]} />}
          <p className="mt-2 text-[11px] text-muted">Quando licenciados, os ajustes do contrato futuro de dólar (B3) serão adicionados como uma quarta série, distinta das demais.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Analisador de curva a termo" subtitle="Compare duas datas, calcule base contra o spot e carrego anualizado" />
        <CurveAnalyzer />
      </Card>
      <Disclaimer />
    </div>
  );
}
