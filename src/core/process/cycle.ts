import { findPrimaryBottleneck } from "./bottleneck";
import { buildProcessModel } from "./mining";
import { simulateImprovement } from "./simulation";
import type {
  Bottleneck,
  CoreCycleResult,
  ProcessEvent,
  SimulationScenario,
} from "./types";

const DEFAULT_WAIT_REDUCTION_PCT = 25;

const createDefaultScenario = (bottleneck: Bottleneck | null): SimulationScenario => ({
  name: bottleneck
    ? `Reduzir espera em ${bottleneck.activity}`
    : "Cenário sem gargalo identificado",
  activityAdjustments: bottleneck
    ? {
        [bottleneck.activity]: {
          waitReductionPct: DEFAULT_WAIT_REDUCTION_PCT,
        },
      }
    : {},
});

export function runCoreCycle(
  events: readonly ProcessEvent[],
  scenario?: SimulationScenario,
): CoreCycleResult {
  const model = buildProcessModel(events);
  const bottleneck = findPrimaryBottleneck(model);
  const simulation = simulateImprovement(events, scenario ?? createDefaultScenario(bottleneck));

  return {
    model,
    metrics: model.metrics,
    bottleneck,
    simulation,
    impact: simulation.impactSummary,
  };
}
