import { describe, expect, it } from "vitest";
import { demoEvents } from "@/data/demo-process";
import type { ProcessEvent } from "./types";
import { simulateImprovement } from "./simulation";

describe("simulateImprovement integration", () => {
  it("reduces cycle time for a positive hypothesis", () => {
    const result = simulateImprovement(demoEvents, {
      name: "Melhoria",
      activityAdjustments: { Aprovação: { waitReductionPct: 30, capacityMultiplier: 1.5 } },
    });
    expect(result.simulated.avgCycleSeconds).toBeLessThan(result.baseline.avgCycleSeconds);
  });

  it("preserves baseline at 0% and 1x", () => {
    const result = simulateImprovement(demoEvents, {
      name: "Neutro",
      activityAdjustments: { Aprovação: { waitReductionPct: 0, capacityMultiplier: 1 } },
    });
    expect(result.simulated).toEqual(result.baseline);
    expect(result.deltas.avgCyclePct).toBe(0);
  });

  it("respects a manual SLA", () => {
    const result = simulateImprovement(demoEvents, {
      name: "SLA manual",
      activityAdjustments: {},
      slaThresholdSeconds: 1,
    });
    expect(result.impactSummary.slaThresholdSeconds).toBe(1);
    expect(result.baseline.slaCompliancePct).toBe(0);
  });

  it("is deterministic", () => {
    const scenario = {
      name: "Determinístico",
      activityAdjustments: { Aprovação: { waitReductionPct: 30, capacityMultiplier: 1.5 } },
    };
    expect(simulateImprovement(demoEvents, scenario)).toEqual(
      simulateImprovement(demoEvents, scenario),
    );
  });

  it("adjusts only intervals whose current event is the target activity", () => {
    const events: ProcessEvent[] = [
      { caseId: "1", activity: "A", timestamp: "2026-01-01T00:00:00Z" },
      { caseId: "1", activity: "B", timestamp: "2026-01-01T00:10:00Z" },
      { caseId: "1", activity: "C", timestamp: "2026-01-01T00:30:00Z" },
    ];
    const targetB = simulateImprovement(events, {
      name: "B",
      activityAdjustments: { B: { waitReductionPct: 50 } },
    });
    const targetC = simulateImprovement(events, {
      name: "C",
      activityAdjustments: { C: { waitReductionPct: 50 } },
    });
    expect(targetB.simulated.avgCycleSeconds).toBe(1_500);
    expect(targetC.simulated.avgCycleSeconds).toBe(1_200);
  });
});
