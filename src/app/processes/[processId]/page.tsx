import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestProcessExplorerData } from "@/features/process-explorer/data";
import { formatDateTime, formatDuration, formatPct } from "@/features/process-explorer/formatters";

export default async function ProcessOverviewPage({
  params,
}: {
  params: Promise<{ processId: string }>;
}) {
  const { processId } = await params;
  const result = await getLatestProcessExplorerData(processId);

  if (result.kind === "not-found") notFound();

  if (result.kind === "error") {
    return (
      <main className="app-shell">
        <section className="panel empty-state">
          <span className="eyebrow">ProcessTwin AI</span>
          <h1>Não foi possível carregar o processo</h1>
          <p>O processo existe, mas a análise mais recente não pôde ser carregada agora.</p>
          <div className="actions">
            <Link className="button secondary" href="/processes/new">Voltar para importação</Link>
          </div>
        </section>
      </main>
    );
  }

  if (result.kind === "no-analysis") {
    return (
      <main className="app-shell">
        <section className="panel empty-state">
          <span className="eyebrow">Processo</span>
          <h1>{result.process.name}</h1>
          <p>Este processo ainda não possui uma análise disponível.</p>
          <Link className="button" href="/processes/new">Importar dados</Link>
        </section>
      </main>
    );
  }

  const { data } = result;
  const bottleneck = data.bottlenecks[0] ?? null;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">ProcessTwin AI · Processo</span>
          <h1>{data.process.name}</h1>
          <p>
            Última análise {formatDateTime(data.analysis.completedAt ?? data.analysis.createdAt)} ·{" "}
            {data.dataset.originalFilename ?? data.dataset.name}
          </p>
        </div>
        <Link className="button" href={`/processes/${data.process.id}/explorer`}>
          Abrir Process Explorer
        </Link>
      </header>

      <section className="metric-grid process-overview-kpis">
        {[
          ["Cases", data.model.metrics.caseCount.toString()],
          ["Eventos", data.model.metrics.eventCount.toString()],
          ["Ciclo médio", formatDuration(data.model.metrics.avgCycleSeconds)],
          ["P95", formatDuration(data.model.metrics.p95CycleSeconds)],
          ["Retrabalho", formatPct(data.model.metrics.reworkRatePct)],
        ].map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel overview-bottleneck">
        <span className="eyebrow">Principal gargalo</span>
        <h2>{bottleneck?.activity ?? "Nenhum gargalo identificado"}</h2>
        {bottleneck ? (
          <p>
            Score <strong>{bottleneck.score}/100</strong> · espera média{" "}
            <strong>{formatDuration(bottleneck.avgWaitSeconds)}</strong> ·{" "}
            {bottleneck.affectedCases} cases afetados.
          </p>
        ) : null}
      </section>
    </main>
  );
}
