import Link from "next/link";
import { runCoreCycle } from "@/core/process/cycle";
import { demoEvents, demoScenario } from "@/data/demo-process";

const duration = (seconds: number) => {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
};

const pct = (value: number) => `${value.toFixed(1)}%`;

export default function DemoPage() {
  const result = runCoreCycle(demoEvents, demoScenario);
  const { model, metrics, bottleneck, simulation, impact } = result;

  return (
    <main style={{ display: "block", maxWidth: 1180, margin: "0 auto" }}>
      <section className="card" style={{ width: "100%", marginBottom: 18 }}>
        <span className="eyebrow">ProcessTwin AI · Core Cycle V1</span>
        <h1 style={{ fontSize: "clamp(34px,6vw,64px)" }}>Processo → problema → melhoria → impacto</h1>
        <p>
          Demonstração executada pelo engine real do ProcessTwin usando um event log de pedidos.
          Nenhum indicador abaixo foi digitado manualmente.
        </p>
        <div className="actions">
          <Link className="button" href="/demo/explorer">Abrir Process Explorer</Link>
          <Link className="button secondary" href="/demo/simulation">Abrir Simulation Lab</Link>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        {[
          ["Casos", metrics.caseCount.toString()],
          ["Eventos", metrics.eventCount.toString()],
          ["Ciclo médio", duration(metrics.avgCycleSeconds)],
          ["P95 do ciclo", duration(metrics.p95CycleSeconds)],
          ["Retrabalho", pct(metrics.reworkRatePct)],
        ].map(([label, value]) => (
          <article className="card" style={{ width: "100%", padding: 20 }} key={label}>
            <p style={{ margin: 0 }}>{label}</p>
            <strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{value}</strong>
          </article>
        ))}
      </section>

      <section className="card" style={{ width: "100%", marginBottom: 18 }}>
        <span className="eyebrow">Processo reconstruído</span>
        <p>
          {model.nodes.length} atividades, {model.edges.length} transições e {model.variants.length}{" "}
          variantes descobertas no log.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 20 }}>
          {model.variants[0]?.path.map((activity, index, path) => (
            <div key={`${activity}-${index}`} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="status" style={{ margin: 0, color: activity === bottleneck?.activity ? "#ff9b9b" : undefined }}>
                {activity}
              </div>
              {index < path.length - 1 ? <span style={{ color: "#6ee7ff" }}>→</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <article className="card" style={{ width: "100%" }}>
          <span className="eyebrow">Problema encontrado</span>
          <h2>{bottleneck?.activity ?? "Nenhum gargalo"}</h2>
          {bottleneck ? (
            <>
              <p>Score de gargalo: <strong>{bottleneck.score}/100</strong></p>
              <p>Espera média antes da etapa: <strong>{duration(bottleneck.avgWaitSeconds)}</strong></p>
              <p>Casos afetados: <strong>{bottleneck.affectedCases}</strong></p>
            </>
          ) : null}
        </article>

        <article className="card" style={{ width: "100%" }}>
          <span className="eyebrow">Melhoria simulada</span>
          <h2>{simulation.scenarioName}</h2>
          <p>Ciclo atual: <strong>{duration(simulation.baseline.avgCycleSeconds)}</strong></p>
          <p>Ciclo simulado: <strong>{duration(simulation.simulated.avgCycleSeconds)}</strong></p>
          <p>Variação: <strong>{pct(simulation.deltas.avgCyclePct)}</strong></p>
        </article>

        <article className="card" style={{ width: "100%" }}>
          <span className="eyebrow">Impacto</span>
          <h2>{impact.hoursSavedPer100Cases.toFixed(1)} h</h2>
          <p>Horas de ciclo economizadas a cada 100 casos no cenário demonstrativo.</p>
          <p>Ganho potencial de throughput: <strong>+{pct(simulation.deltas.throughputGainPct)}</strong></p>
          <p>SLA: <strong>{simulation.deltas.slaPercentagePoints >= 0 ? "+" : ""}{simulation.deltas.slaPercentagePoints.toFixed(1)} p.p.</strong></p>
        </article>
      </section>
    </main>
  );
}
