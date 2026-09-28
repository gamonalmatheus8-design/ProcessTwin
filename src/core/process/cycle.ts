import { findPrimaryBottleneck } from "./bottleneck";
import { buildProcessModel } from "./mining";
import { simulateImprovement } from "./simulation";
import type {
  CoreCycleResult,
  ProcessEvent,
  SimulationScenario,
} from "./types";

export function runCoreCycle(
  events: ProcessEvent[],
  scenario: SimulationScenario,
): CoreCycleResult {
  const model = buildProcessModel(events);
  const bottleneck = findPrimaryBottleneck(model);
  const simulation = simulateImprovement(events, scenario);

  return {
    model,
    bottleneck,
    simulation,
  };
}
