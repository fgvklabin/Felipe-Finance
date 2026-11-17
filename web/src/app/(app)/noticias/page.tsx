import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Disclaimer, Empty, Notice, PageHeader } from "@/components/ui";
import { ShareCard } from "@/components/news/ShareCard";
import { marketNotes } from "@/lib/insights";
import { getCatalog } from "@/lib/market";
import { query } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Notícias" };

const CATS: Record<string, string> = {
  agricolas: "Agricultura", metais: "Metais", "metais-preciosos": "Metais preciosos", polimeros: "Polímeros", quimicos: "Químicos",
  "papel-celulose": "Papel e celulose", energia: "Energia", moedas: "Moedas", macro: "Macroeconomia global", empresas: "Empresas", fundos: "Fundos",
};

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const notes = marketNotes().filter((n) => !cat || n.category === cat);
  const catalog = getCatalog();
  const name = (id: string) => catalog.instruments.find((i) => i.id === id)?.name.pt ?? id;
  const feed = await query<{ id: string; title: string; source_name: string; source_url: string; published_at: string; summary: string | null }>(
    "SELECT id, title, source_name, source_url, published_at, summary FROM news ORDER BY published_at DESC LIMIT 30",
  ).catch(() => []);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Inteligência" title="Notícias e inteligência econômica" subtitle="Notas automáticas geradas a partir de dados oficiais, com “Por que isso importa?”. Manchetes externas aparecem apenas de feeds autorizados, sempre com link para a fonte original." />
      <div className="flex flex-wrap gap-1.5">
        <Link href="/noticias" className={`rounded-full border px-3 py-1 text-xs ${!cat ? "border-blue bg-blue/15" : "border-line text-muted"}`}>Todas</Link>
        {Object.entries(CATS).map(([k, v]) => (
          <Link key={k} href={`/noticias?cat=${k}`} className={`rounded-full border px-3 py-1 text-xs ${cat === k ? "border-blue bg-blue/15" : "border-line text-muted"}`}>{v}</Link>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {notes.length === 0 && <Empty title="Nenhuma nota nesta categoria">As notas são geradas quando os dados mostram movimentos relevantes.</Empty>}
          {notes.map((n) => (
            <Card key={n.id} id={n.id}>
              <CardHeader
                title={n.title}
                subtitle={<>{n.source.url ? <a href={n.source.url} target="_blank" rel="noopener noreferrer" className="underline">{n.source.label}</a> : n.source.label} · {fmtDate(n.date)} · {CATS[n.category] ?? n.category}</>}
                right={<Badge tone="cyan">Gerada a partir de dados</Badge>}
              />
              <CardBody className="space-y-3 text-[13px]">
                <p className="text-fg-2">{n.summary}</p>
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-400"><Lightbulb size={14} /> Por que isso importa?</div>
                  <p className="text-fg-2">{n.whyItMatters}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div><div className="text-[11px] font-semibold text-up">Possíveis efeitos positivos</div><ul className="list-disc pl-4 text-xs text-fg-2">{n.positives.length ? n.positives.map((p) => <li key={p}>{p}</li>) : <li>—</li>}</ul></div>
                    <div><div className="text-[11px] font-semibold text-down">Possíveis efeitos negativos</div><ul className="list-disc pl-4 text-xs text-fg-2">{n.negatives.length ? n.negatives.map((p) => <li key={p}>{p}</li>) : <li>—</li>}</ul></div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {n.relatedCommodities.map((c) => <Link key={c} href={`/commodity/${c}`}><Badge tone="green">{name(c)}</Badge></Link>)}
                  {n.relatedCompanies.map((c) => <Link key={c} href={`/empresas/${c}`}><Badge tone="blue">{c}</Badge></Link>)}
                </div>
                <ShareCard title={n.title} summary={n.summary} source={n.source.label} date={fmtDate(n.date)} url={`/noticias#${n.id}`} />
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Feeds autorizados" subtitle="Manchetes com link para a fonte original" />
            <CardBody>
              {feed.length === 0 ? (
                <Notice tone="gold">
                  Nenhum feed autorizado configurado nesta implantação. Defina <code>NEWS_FEEDS</code> com RSS de fontes que permitam o uso (ex.: comunicados oficiais) e libere os hosts na rede. Exibimos apenas título, link e resumo próprio — nunca o texto integral.
                </Notice>
              ) : (
                <ul className="divide-y divide-line">
                  {feed.map((f) => (
                    <li key={f.id} className="py-2 text-[13px]">
                      <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-blue">{f.title}</a>
                      <div className="text-[11px] text-muted">{f.source_name} · {fmtDate(f.published_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Relatórios" />
            <CardBody className="space-y-2 text-[13px]">
              <Link href="/relatorios/diario" className="block rounded-lg border border-line p-3 hover:border-line-strong"><b>Relatório diário</b><div className="text-xs text-muted">Câmbio, macro, maiores movimentos e previsões</div></Link>
              <Link href="/relatorios/semanal" className="block rounded-lg border border-line p-3 hover:border-line-strong"><b>Relatório semanal</b><div className="text-xs text-muted">Variações da semana e expectativas Focus</div></Link>
            </CardBody>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
