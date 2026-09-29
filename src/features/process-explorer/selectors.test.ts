import { describe, expect, it } from "vitest";
import type { Bottleneck, ProcessNode, ProcessVariant } from "@/core/process/types";
import {
  buildExecutiveInsight,
  classifyActivityHealth,
  edgeKey,
  getActivityCoveragePct,
  getActivityReworkPct,
  getVariantEdgeKeys,
  getVariantPct,
  sortVariants,
} from "./selectors";

const nodes: ProcessNode[] = [
  { activity: "Recebido", eventCount: 10, caseCount: 10, reworkCount: 0, avgIncomingWaitSeconds: 0 },
  { activity: "Análise", eventCount: 12, caseCount: 10, reworkCount: 2, avgIncomingWaitSeconds: 1200 },
  { activity: "Aprovação", eventCount: 10, caseCount: 10, reworkCount: 0, avgIncomingWaitSeconds: 18000 },
];

const bottleneck: Bottleneck = {
  activity: "Aprovação",
  score: 92,
  severity: "critical",
  avgWaitSeconds: 18000,
  affectedCases: 10,
  reworkRatePct: 0,
  evidence: { waitWeight: 1, volumeWeight: 1, reworkWeight: 0 },
};

describe("Process Explorer selectors", () => {
  it("calculates activity coverage and rework", () => {
    expect(getActivityCoveragePct(nodes[1], 10)).toBe(100);
    expect(getActivityReworkPct(nodes[1])).toBeCloseTo(16.666, 2);
  });

  it("keeps the official bottleneck critical", () => {
    expect(classifyActivityHealth(nodes[2], nodes, bottleneck)).toBe("critical");
    expect(classifyActivityHealth(nodes[0], nodes, bottleneck)).toBe("healthy");
  });

  it("calculates and sorts variants deterministically", () => {
    const variants: ProcessVariant[] = [
      { path: ["Recebido", "Análise", "Aprovação"], caseCount: 8 },
      { path: ["Recebido", "Aprovação"], caseCount: 2 },
    ];
    expect(getVariantPct(variants[0], 10)).toBe(80);
    expect(sortVariants([...variants].reverse())[0]).toEqual(variants[0]);
  });

  it("selects only edges that belong to a variant", () => {
    const variant: ProcessVariant = {
      path: ["Recebido", "Análise", "Aprovação"],
      caseCount: 8,
    };
    const keys = getVariantEdgeKeys(variant);
    expect(keys.has(edgeKey("Recebido", "Análise"))).toBe(true);
    expect(keys.has(edgeKey("Análise", "Aprovação"))).toBe(true);
    expect(keys.has(edgeKey("Recebido", "Aprovação"))).toBe(false);
  });

  it("builds deterministic executive insight from calculated data", () => {
    const text = buildExecutiveInsight(nodes, bottleneck, 10);
    expect(text).toContain("Principal gargalo: Aprovação");
    expect(text).toContain("intervalo médio observado");
    expect(text).toContain("100% dos cases");
    expect(text).toContain("retrabalho");
    expect(text).toContain("Análise");
  });
});
