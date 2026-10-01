import { describe, expect, it } from "vitest";
import { runCoreCycle } from "@/core/process/cycle";
import { groupAndOrderEvents } from "@/core/process/events";
import { simulateImprovement } from "@/core/process/simulation";
import { prepareRecurringCsv } from "@/features/sync/recurring-csv";
import { createDemoDataset, demoIds, demoStep, isDemoId } from "./datasets";
import { compareTeams, datasetCsv, getDemo } from "./model";

const targets = {
  enrollment: "Conferência",
  tuition: "Conciliação",
  tickets: "Correção",
};
describe("synthetic demonstration contracts", () => {
  it.each(demoIds)(
    "%s: stable identities, complete cases, genuine variants and team composition",
    (id) => {
      const dataset = createDemoDataset(id);
      expect(dataset).toEqual(createDemoDataset(id));
      expect(
        new Set(dataset.records.map((record) => record.eventId)).size,
      ).toBe(dataset.records.length);
      const cases = groupAndOrderEvents(dataset.records);
      expect(cases).toHaveLength(36);
      for (const [, events] of cases) {
        expect(events.at(-1)!.timestamp > events[0].timestamp).toBe(true);
        expect(new Set(events.map((event) => event.resource)).size).toBe(1);
      }
      const { result, teams } = getDemo(id);
      expect(result).toEqual(runCoreCycle(dataset.records));
      expect(result.bottleneck?.activity).toBe(targets[id]);
      expect(result.model.variants).toHaveLength(2);
      expect(result.metrics.reworkRatePct).toBe(25);
      expect(teams.reduce((sum, team) => sum + team.caseCount, 0)).toBe(
        result.metrics.caseCount,
      );
      const weightedCycle =
        teams.reduce(
          (sum, team) => sum + team.caseCount * team.avgCycleSeconds,
          0,
        ) / result.metrics.caseCount;
      expect(weightedCycle).toBeCloseTo(result.metrics.avgCycleSeconds, 6);
      expect(compareTeams(dataset.records.slice().reverse())).toEqual(teams);
    },
  );
  it.each(demoIds)(
    "%s: downloadable CSV returns the same canonical events through the real parser",
    (id) => {
      const dataset = createDemoDataset(id);
      const batch = prepareRecurringCsv(
        datasetCsv(dataset.records),
        {
          caseId: "case_id",
          activity: "activity",
          timestamp: "timestamp",
          resource: "resource",
        },
        { strategy: "source_id", fields: ["event_id"], version: "v1" },
      );
      expect(batch.invalid).toBe(0);
      expect(batch.records).toHaveLength(dataset.records.length);
      expect(runCoreCycle(batch.records).model).toEqual(
        runCoreCycle(dataset.records).model,
      );
      expect(
        new Set(batch.records.map((record) => record.sourceEventKey)).size,
      ).toBe(batch.records.length);
    },
  );
  it.each(demoIds)(
    "%s: zero adjustment preserves baseline, reduction estimates improvement without changing variants",
    (id) => {
      const { dataset, result } = getDemo(id);
      const activity = result.bottleneck!.activity;
      const neutral = simulateImprovement(dataset.records, {
        name: "Neutral",
        activityAdjustments: {},
        slaThresholdSeconds: dataset.slaHours * 3600,
      });
      expect(neutral.baseline).toEqual(neutral.simulated);
      const scenario = simulateImprovement(dataset.records, {
        name: "Estimate",
        activityAdjustments: { [activity]: { waitReductionPct: 30 } },
        slaThresholdSeconds: dataset.slaHours * 3600,
      });
      expect(scenario.simulated.avgCycleSeconds).toBeLessThan(
        scenario.baseline.avgCycleSeconds,
      );
      expect(scenario.impactSummary.slaThresholdSeconds).toBe(
        dataset.slaHours * 3600,
      );
      expect(scenario.impactSummary.hoursSavedPer100Cases).toBeCloseTo(
        (scenario.impactSummary.secondsSavedPerCase * 100) / 3600,
        1,
      );
      expect(getDemo(id).result.model.variants).toEqual(result.model.variants);
    },
  );
  it("unknown IDs and steps cannot select arbitrary sources", () => {
    expect(isDemoId("constructor")).toBe(false);
    expect(isDemoId("../tickets")).toBe(false);
    expect(demoStep("impact")).toBe(4);
    expect(demoStep("unknown")).toBe(0);
  });
});
