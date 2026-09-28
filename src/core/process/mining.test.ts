import { describe, expect, it } from "vitest";
import { InvalidProcessEventError } from "./events";
import { buildProcessModel } from "./mining";
import type { ProcessEvent } from "./types";

const event = (caseId: string, activity: string, minute: number): ProcessEvent => ({
  caseId,
  activity,
  timestamp: `2026-09-15T10:${minute.toString().padStart(2, "0")}:00Z`,
});

describe("buildProcessModel", () => {
  it("groups events by caseId without creating transitions between cases", () => {
    const model = buildProcessModel([
      event("CASE-1", "A", 0),
      event("CASE-2", "X", 1),
      event("CASE-1", "B", 2),
      event("CASE-2", "Y", 3),
    ]);

    expect(model.metrics.caseCount).toBe(2);
    expect(model.edges).toEqual([
      { source: "A", target: "B", count: 1, avgWaitSeconds: 120 },
      { source: "X", target: "Y", count: 1, avgWaitSeconds: 120 },
    ]);
  });

  it("orders events chronologically before discovering the path", () => {
    const model = buildProcessModel([
      event("CASE-1", "C", 20),
      event("CASE-1", "A", 0),
      event("CASE-1", "B", 10),
    ]);

    expect(model.variants[0].path).toEqual(["A", "B", "C"]);
    expect(model.edges.map(({ source, target }) => [source, target])).toEqual([
      ["A", "B"],
      ["B", "C"],
    ]);
  });

  it("counts repeated transitions correctly", () => {
    const model = buildProcessModel([
      event("CASE-1", "A", 0),
      event("CASE-1", "B", 10),
      event("CASE-2", "A", 1),
      event("CASE-2", "B", 11),
    ]);

    expect(model.edges).toContainEqual({
      source: "A",
      target: "B",
      count: 2,
      avgWaitSeconds: 600,
    });
  });

  it("calculates variants for several process paths", () => {
    const model = buildProcessModel([
      event("CASE-1", "A", 0),
      event("CASE-1", "B", 10),
      event("CASE-2", "A", 1),
      event("CASE-2", "B", 11),
      event("CASE-3", "A", 2),
      event("CASE-3", "C", 12),
    ]);

    expect(model.variants).toEqual([
      { path: ["A", "B"], caseCount: 2 },
      { path: ["A", "C"], caseCount: 1 },
    ]);
  });

  it("identifies repeated activities as rework", () => {
    const model = buildProcessModel([
      event("CASE-1", "A", 0),
      event("CASE-1", "B", 10),
      event("CASE-1", "A", 20),
      event("CASE-2", "A", 1),
      event("CASE-2", "B", 11),
    ]);

    expect(model.nodes.find((node) => node.activity === "A")?.reworkCount).toBe(1);
    expect(model.metrics.reworkRatePct).toBe(50);
  });

  it("calculates average and p95 cycle time across unequal cases", () => {
    const model = buildProcessModel([
      event("CASE-1", "A", 0),
      event("CASE-1", "B", 10),
      event("CASE-2", "A", 0),
      event("CASE-2", "B", 20),
    ]);

    expect(model.metrics.avgCycleSeconds).toBe(900);
    expect(model.metrics.p95CycleSeconds).toBe(1200);
  });

  it("returns an empty model for an empty event log", () => {
    expect(buildProcessModel([])).toEqual({
      nodes: [],
      edges: [],
      variants: [],
      metrics: {
        caseCount: 0,
        eventCount: 0,
        avgCycleSeconds: 0,
        p95CycleSeconds: 0,
        reworkRatePct: 0,
      },
    });
  });

  it("handles a single event without transitions or cycle time", () => {
    const model = buildProcessModel([event("CASE-1", "A", 0)]);

    expect(model.metrics).toMatchObject({ caseCount: 1, eventCount: 1, avgCycleSeconds: 0 });
    expect(model.edges).toEqual([]);
    expect(model.variants).toEqual([{ path: ["A"], caseCount: 1 }]);
  });

  it("rejects invalid timestamps explicitly", () => {
    expect(() =>
      buildProcessModel([{ caseId: "CASE-1", activity: "A", timestamp: "not-a-date" }]),
    ).toThrow(InvalidProcessEventError);
  });
});
