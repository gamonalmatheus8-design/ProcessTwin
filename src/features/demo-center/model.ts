import Papa from "papaparse";
import { runCoreCycle } from "@/core/process/cycle";
import { groupAndOrderEvents } from "@/core/process/events";
import type { ProcessEvent } from "@/core/process/types";
import { createDemoDataset, type DemoId, type DemoRecord } from "./datasets";

export function compareTeams(events: readonly ProcessEvent[]) {
  const teams = new Map<
    string,
    { count: number; cycle: number; reworked: number }
  >();
  for (const [, ordered] of groupAndOrderEvents(events)) {
    const team = ordered[0].resource ?? "Sem equipe";
    const current = teams.get(team) ?? { count: 0, cycle: 0, reworked: 0 };
    current.count++;
    current.cycle +=
      (Date.parse(ordered.at(-1)!.timestamp) -
        Date.parse(ordered[0].timestamp)) /
      1000;
    current.reworked +=
      new Set(ordered.map((event) => event.activity)).size < ordered.length
        ? 1
        : 0;
    teams.set(team, current);
  }
  return [...teams]
    .sort(([left], [right]) => left.localeCompare(right, "pt-BR"))
    .map(([name, values]) => ({
      name,
      caseCount: values.count,
      avgCycleSeconds: values.cycle / values.count,
      reworkPct: (values.reworked / values.count) * 100,
    }));
}
export function datasetCsv(records: readonly DemoRecord[]) {
  return Papa.unparse(
    records.map((record) => ({
      event_id: record.eventId,
      case_id: record.caseId,
      activity: record.activity,
      timestamp: record.timestamp,
      resource: record.resource,
      priority: record.priority,
      category: record.category,
    })),
    { newline: "\r\n" },
  );
}
export function getDemo(id: DemoId) {
  const dataset = createDemoDataset(id);
  const result = runCoreCycle(dataset.records);
  const dates = dataset.records.map((record) => record.timestamp).sort();
  return {
    dataset,
    result,
    teams: compareTeams(dataset.records),
    period: { start: dates[0], end: dates.at(-1)! },
  };
}
