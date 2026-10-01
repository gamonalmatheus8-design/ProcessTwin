import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
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
      <AppShell active="overview" processId={processId}>
        <section className="panel empty-state">
          <span className="eyebrow">Process unavailable</span>
          <h1>Não foi possível carregar o processo</h1>
          <p>O processo existe, mas a análise mais recente não pôde ser carregada agora.</p>
          <div className="actions"><Link className="button secondary" href="/processes/new">Voltar para importação</Link></div>
        </section>
      </AppShell>
    );
  }

  if (result.kind === "no-analysis") {
    return (
      <AppShell active="overview" processId={processId} processName={result.process.name}>
        <section className="panel empty-state">
          <span className="eyebrow">Process workspace</span>
          <h1>{result.process.name}</h1>
          <p>Este processo ainda não possui uma análise concluída.</p>
          <div className="actions">
            <Link className="button" href="/processes/new">Importar dados</Link>
            <Link className="button secondary" href={`/processes/${processId}/connectors`}>Conectores</Link>
          </div>
        </section>
      </AppShell>
    );
  }

  const { data } = result;
  const bottleneck = data.bottlenecks[0] ?? null;
  const bottleneckScore = bottleneck?.score ?? 0;

  return (
    <AppShell active="overview" processId={processId} processName={data.process.name}>
      <header className="pt-page-heading">
        <div>
          <span className="eyebrow">Process Overview</span>
          <h1>{data.process.name}</h1>
          <p>
            Última análise {formatDateTime(data.analysis.completedAt ?? data.analysis.createdAt)} ·{" "}
            {data.dataset.originalFilename ?? data.dataset.name}
          </p>
        </div>
        <div className="actions">
          <Link className="button secondary" href={`/processes/${processId}/connectors`}>Conectores</Link>
          <Link className="button" href={`/processes/${data.process.id}/explorer`}>Abrir Explorer</Link>
        </div>
      </header>

      <section className="pt-stat-strip" aria-label="Indicadores principais">
        {[
          ["Cases", data.model.metrics.caseCount.toString()],
          ["Eventos", data.model.metrics.eventCount.toString()],
          ["Ciclo médio", formatDuration(data.model.metrics.avgCycleSeconds)],
          ["P95", formatDuration(data.model.metrics.p95CycleSeconds)],
          ["Retrabalho", formatPct(data.model.metrics.reworkRatePct)],
        ].map(([label, value]) => (
          <article className="pt-stat" key={label}><span>{label}</span><strong>{value}</strong></article>
        ))}
      </section>

      <div className="pt-dashboard-grid">
        <section className="pt-dashboard-panel">
          <span className="eyebrow">Critical path</span>
          <h2>{bottleneck?.activity ?? "Nenhum gargalo crítico identificado"}</h2>
          <p>
            {bottleneck
              ? `${bottleneck.affectedCases} cases apresentam espera relevante antes desta atividade.`
              : "O modelo atual não destacou uma atividade como principal gargalo."}
          </p>
          <div className="pt-bottleneck-score">
            <strong>{bottleneckScore}</strong>
            <span>BOTTLENECK SCORE<br />0 — 100</span>
          </div>
          <div className="pt-health-line" aria-label={`Score de gargalo ${bottleneckScore} de 100`}>
            <i style={{ width: `${Math.max(3, bottleneckScore)}%` }} />
          </div>
          {bottleneck && (
            <p style={{ marginTop: 14 }}>
              Intervalo médio observado <strong>{formatDuration(bottleneck.avgWaitSeconds)}</strong>.
            </p>
          )}
        </section>

        <aside className="pt-dashboard-panel">
          <span className="eyebrow">Continue analysis</span>
          <h2>Workspace operacional</h2>
          <p>Use a mesma análise base para investigar o fluxo, testar hipóteses e manter os dados atualizados.</p>
          <nav className="pt-quick-links">
            <Link className="pt-quick-link" href={`/processes/${processId}/explorer`}><span>Process Explorer</span><span>→</span></Link>
            <Link className="pt-quick-link" href={`/processes/${processId}/simulation`}><span>Simulation Lab</span><span>→</span></Link>
            <Link className="pt-quick-link" href={`/processes/${processId}/connectors`}><span>Connector Center</span><span>→</span></Link>
          </nav>
        </aside>
      </div>
    </AppShell>
  );
}
