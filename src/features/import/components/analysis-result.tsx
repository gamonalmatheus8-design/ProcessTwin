import Link from "next/link";
import type { ImportAnalysisResponse } from "../types";

const duration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
};
const pct = (value: number) => `${value.toFixed(1)}%`;

export function AnalysisResult({ result }: { result: ImportAnalysisResponse }) {
  const { analysis } = result;
  return (
    <div className="result-stack">
      <div className="success-banner"><strong>Importação concluída.</strong> {result.validation.validRows} eventos foram analisados no processo {result.process.name}.</div>
      <section className="metric-grid" aria-label="Métricas do processo">
        {[
          ["Casos", analysis.metrics.caseCount.toString()], ["Eventos", analysis.metrics.eventCount.toString()],
          ["Ciclo médio", duration(analysis.metrics.avgCycleSeconds)], ["P95", duration(analysis.metrics.p95CycleSeconds)],
          ["Retrabalho", pct(analysis.metrics.reworkRatePct)],
        ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="panel">
        <span className="eyebrow">Processo reconstruído</span>
        <h2>{analysis.model.nodes.length} atividades · {analysis.model.edges.length} transições · {analysis.model.variants.length} variantes</h2>
        <div className="flow-line">
          {analysis.model.variants[0]?.path.map((activity, index) => <span className={activity === analysis.bottleneck?.activity ? "flow-node danger" : "flow-node"} key={`${activity}-${index}`}>{activity}</span>)}
        </div>
        <div className="actions">
          <Link className="button" href={`/processes/${result.process.id}/explorer`}>
            Abrir Process Explorer
          </Link>
        </div>
      </section>
      <div className="result-grid">
        <section className="panel"><span className="eyebrow">Problema encontrado</span><h2>{analysis.bottleneck?.activity ?? "Nenhum gargalo"}</h2>{analysis.bottleneck && <><p>Score <strong>{analysis.bottleneck.score}/100</strong> · severidade {analysis.bottleneck.severity}</p><p>Espera média <strong>{duration(analysis.bottleneck.avgWaitSeconds)}</strong> · {analysis.bottleneck.affectedCases} casos afetados</p></>}</section>
        <section className="panel"><span className="eyebrow">Melhoria simulada</span><h2>{analysis.simulation.scenarioName}</h2><p>Ciclo: <strong>{duration(analysis.simulation.baseline.avgCycleSeconds)}</strong> → <strong>{duration(analysis.simulation.simulated.avgCycleSeconds)}</strong></p><p>Variação: <strong>{pct(analysis.simulation.deltas.avgCyclePct)}</strong></p></section>
        <section className="panel"><span className="eyebrow">Impacto</span><h2>{analysis.impact.hoursSavedPer100Cases.toFixed(1)} h / 100 casos</h2><p>{Math.round(analysis.impact.secondsSavedPerCase / 60)} min economizados por caso</p><p>Throughput potencial: <strong>+{pct(analysis.simulation.deltas.throughputGainPct)}</strong> · SLA: <strong>{analysis.simulation.deltas.slaPercentagePoints >= 0 ? "+" : ""}{analysis.simulation.deltas.slaPercentagePoints.toFixed(1)} p.p.</strong></p></section>
      </div>
    </div>
  );
}
