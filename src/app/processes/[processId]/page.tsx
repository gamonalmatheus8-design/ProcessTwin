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
  const topActivities = [...data.model.nodes]
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 6);
  const maxEvents = Math.max(...topActivities.map((node) => node.eventCount), 1);
  const topVariants = data.model.variants.slice(0, 5);

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
          <Link className="button secondary" href={`/processes/${processId}/connectors`}>Connector Center</Link>
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

      <div className="pt-overview-grid">
        <div className="pt-overview-stack">
          <section className="pt-dashboard-panel">
            <div className="pt-panel-header">
              <div>
                <span className="eyebrow">Operational volume</span>
                <h2>Atividades mais frequentes</h2>
              </div>
              <small>{data.model.nodes.length} atividades no modelo</small>
            </div>
            <div className="pt-activity-bars" aria-label="Volume de eventos por atividade">
              {topActivities.map((node) => (
                <div className="pt-activity-bar" key={node.activity}>
                  <div className="pt-activity-bar-track">
                    <i style={{ height: `${Math.max(8, (node.eventCount / maxEvents) * 100)}%` }} />
                  </div>
                  <div>
                    <strong title={node.activity}>{node.activity}</strong>
                    <small>{node.eventCount} eventos</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-dashboard-panel">
            <div className="pt-panel-header">
              <div>
                <span className="eyebrow">Process variants</span>
                <h2>Rotas mais recorrentes</h2>
              </div>
              <Link className="text-link" href={`/processes/${processId}/explorer`}>Abrir análise</Link>
            </div>
            <div className="pt-overview-list">
              {topVariants.length ? topVariants.map((variant, index) => (
                <div className="pt-overview-list-row" key={`${variant.path.join(">")}:${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{variant.path.join(" → ")}</strong>
                    <small>{variant.path.length} etapas</small>
                  </div>
                  <strong>{variant.caseCount} cases</strong>
                </div>
              )) : (
                <p>Nenhuma variante disponível para esta análise.</p>
              )}
            </div>
          </section>
        </div>

        <div className="pt-overview-stack">
          <section className="pt-dashboard-panel pt-accent-panel">
            <span className="eyebrow">Critical bottleneck</span>
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
            <p>Investigue o fluxo, teste hipóteses e mantenha o dataset vivo no mesmo contexto.</p>
            <nav className="pt-quick-links">
              <Link className="pt-quick-link" href={`/processes/${processId}/explorer`}><span>Process Explorer</span><span>→</span></Link>
              <Link className="pt-quick-link" href={`/processes/${processId}/simulation`}><span>Simulation Lab</span><span>→</span></Link>
              <Link className="pt-quick-link" href={`/processes/${processId}/connectors`}><span>Connector Center</span><span>→</span></Link>
            </nav>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
