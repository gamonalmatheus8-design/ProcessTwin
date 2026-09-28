import { describe, expect, it } from "vitest";
import { demoEvents, demoScenario } from "@/data/demo-process";
import { runCoreCycle } from "./cycle";
import { simulateImprovement } from "./simulation";

describe("ProcessTwin core cycle", () => {
  it("finds Aprovação as the main bottleneck in the demo dataset", () => {
    const result = runCoreCycle(demoEvents, demoScenario);

    expect(result.bottleneck?.activity).toBe("Aprovação");
    expect(result.bottleneck?.avgWaitSeconds).toBeGreaterThan(0);
  });

  it("reduces average cycle time and produces throughput gain", () => {
    const simulation = simulateImprovement(demoEvents, demoScenario);

    expect(simulation.simulated.avgCycleSeconds).toBeLessThan(
      simulation.baseline.avgCycleSeconds,
    );
    expect(simulation.deltas.avgCyclePct).toBeLessThan(0);
    expect(simulation.deltas.throughputGainPct).toBeGreaterThan(0);
    expect(simulation.impactSummary.secondsSavedPerCase).toBeGreaterThan(0);
  });

  it("is deterministic even when the same events arrive in reverse order", () => {
    const first = runCoreCycle(demoEvents, demoScenario);
    const second = runCoreCycle([...demoEvents].reverse(), demoScenario);

    expect(second).toEqual(first);
  });

  it("keeps empty and single-event simulations finite", () => {
    const empty = simulateImprovement([], demoScenario);
    const single = simulateImprovement([demoEvents[0]], demoScenario);

    expect(empty.baseline.avgCycleSeconds).toBe(0);
    expect(empty.deltas.throughputGainPct).toBe(0);
    expect(single.simulated.avgCycleSeconds).toBe(0);
    expect(single.deltas.throughputGainPct).toBe(0);
  });
});
