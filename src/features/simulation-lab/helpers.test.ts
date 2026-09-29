import { describe, expect, it } from "vitest";
import { simulateImprovement } from "@/core/process/simulation";
import { demoEvents } from "@/data/demo-process";
import {
  buildOpportunityCard,
  effectiveFactor,
  formatDuration,
  formatPercentagePoints,
  formatPercent,
  isAggressiveScenario,
} from "./helpers";

describe("simulation UI helpers", () => {
  it("calculates the effective factor", () => {
    expect(effectiveFactor(30, 1.5)).toBeCloseTo(0.466_666, 5);
  });

  it("classifies aggressive scenarios using every rule", () => {
    expect(isAggressiveScenario(70, 1)).toBe(true);
    expect(isAggressiveScenario(10, 2.5)).toBe(true);
    expect(isAggressiveScenario(60, 3)).toBe(true);
    expect(isAggressiveScenario(30, 1.5)).toBe(false);
  });

  it("builds a deterministic Opportunity Card", () => {
    const payload = {
      activity: "Aprovação",
      waitReductionPct: 30,
      capacityMultiplier: 1.5,
    };
    const result = simulateImprovement(demoEvents, {
      name: "Teste",
      activityAdjustments: { Aprovação: payload },
    });

    expect(buildOpportunityCard(payload, result)).toContain(
      "reduzir 30% do atraso observado em Aprovação",
    );
    expect(buildOpportunityCard(payload, result)).toContain("Ganho potencial de throughput");
  });

  it("formats comparison values without relying on color", () => {
    expect(formatDuration(7_500)).toBe("2h05");
    expect(formatPercent(-30.25, true)).toBe("-30.3%");
    expect(formatPercent(43.24, true)).toBe("+43.2%");
    expect(formatPercentagePoints(20)).toBe("+20.0 p.p.");
  });
});
