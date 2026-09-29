import type {
  ProcessEvent,
  SimulationMetrics,
  SimulationResult,
  SimulationScenario,
} from "./types";
import { groupAndOrderEvents } from "./events";

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function summarize(cycles: number[], slaThresholdSeconds: number): SimulationMetrics {
  return {
    avgCycleSeconds: average(cycles),
    p95CycleSeconds: percentile(cycles, 0.95),
    slaCompliancePct: cycles.length
      ? (cycles.filter((cycle) => cycle <= slaThresholdSeconds).length / cycles.length) * 100
      : 0,
  };
}

export function simulateImprovement(
  events: readonly ProcessEvent[],
  scenario: SimulationScenario,
): SimulationResult {
  const grouped = groupAndOrderEvents(events);

  const baselineCycles: number[] = [];
  const simulatedCycles: number[] = [];

  for (const [, ordered] of grouped) {
    if (ordered.length < 2) {
      baselineCycles.push(0);
      simulatedCycles.push(0);
      continue;
    }

    let baseline = 0;
    let simulated = 0;

    for (let i = 1; i < ordered.length; i += 1) {
      const current = ordered[i];
      const previous = ordered[i - 1];
      const waitSeconds = Math.max(
        0,
        (Date.parse(current.timestamp) - Date.parse(previous.timestamp)) / 1000,
      );
      baseline += waitSeconds;

      const adjustment = scenario.activityAdjustments[current.activity];
      const reduction = Math.min(95, Math.max(0, adjustment?.waitReductionPct ?? 0)) / 100;
      const capacity = Math.max(0.1, adjustment?.capacityMultiplier ?? 1);
      const factor = Math.max(0.05, (1 - reduction) / capacity);
      simulated += waitSeconds * factor;
    }

    baselineCycles.push(baseline);
    simulatedCycles.push(simulated);
  }

  const baselineSla = scenario.slaThresholdSeconds ?? percentile(baselineCycles, 0.75);
  const baseline = summarize(baselineCycles, baselineSla);
  const simulated = summarize(simulatedCycles, baselineSla);

  const avgCyclePct = baseline.avgCycleSeconds
    ? ((simulated.avgCycleSeconds - baseline.avgCycleSeconds) / baseline.avgCycleSeconds) * 100
    : 0;
  const p95CyclePct = baseline.p95CycleSeconds
    ? ((simulated.p95CycleSeconds - baseline.p95CycleSeconds) / baseline.p95CycleSeconds) * 100
    : 0;
  const throughputGainPct = simulated.avgCycleSeconds
    ? (baseline.avgCycleSeconds / simulated.avgCycleSeconds - 1) * 100
    : 0;
  const secondsSavedPerCase = Math.max(0, baseline.avgCycleSeconds - simulated.avgCycleSeconds);

  return {
    scenarioName: scenario.name,
    baseline,
    simulated,
    deltas: {
      avgCyclePct: Number(avgCyclePct.toFixed(2)),
      p95CyclePct: Number(p95CyclePct.toFixed(2)),
      slaPercentagePoints: Number(
        (simulated.slaCompliancePct - baseline.slaCompliancePct).toFixed(2),
      ),
      throughputGainPct: Number(throughputGainPct.toFixed(2)),
    },
    impactSummary: {
      secondsSavedPerCase: Math.round(secondsSavedPerCase),
      hoursSavedPer100Cases: Number(((secondsSavedPerCase * 100) / 3600).toFixed(2)),
      slaThresholdSeconds: baselineSla,
    },
  };
}
