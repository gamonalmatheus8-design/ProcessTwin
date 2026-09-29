import type { ProcessMetrics } from "@/core/process/types";
import { formatDuration, formatPct } from "./formatters";

export function ProcessKpis({
  metrics,
  activityCount,
  variantCount,
}: {
  metrics: ProcessMetrics;
  activityCount: number;
  variantCount: number;
}) {
  const items = [
    ["Cases", metrics.caseCount.toString()],
    ["Eventos", metrics.eventCount.toString()],
    ["Ciclo médio", formatDuration(metrics.avgCycleSeconds)],
    ["P95", formatDuration(metrics.p95CycleSeconds)],
    ["Retrabalho", formatPct(metrics.reworkRatePct)],
    ["Atividades", activityCount.toString()],
    ["Variantes", variantCount.toString()],
  ];

  return (
    <section className="explorer-kpis" aria-label="Indicadores do processo">
      {items.map(([label, value]) => (
        <article className="explorer-kpi" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
