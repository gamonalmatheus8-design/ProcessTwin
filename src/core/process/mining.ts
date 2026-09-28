import type {
  ProcessEdge,
  ProcessEvent,
  ProcessModel,
  ProcessNode,
  ProcessVariant,
} from "./types";

const toSeconds = (ms: number) => Math.max(0, ms / 1000);

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

export function buildProcessModel(events: ProcessEvent[]): ProcessModel {
  if (!events.length) {
    return {
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
    };
  }

  const cases = new Map<string, ProcessEvent[]>();
  for (const event of events) {
    if (!event.caseId?.trim() || !event.activity?.trim()) continue;
    const ts = Date.parse(event.timestamp);
    if (Number.isNaN(ts)) continue;
    const list = cases.get(event.caseId) ?? [];
    list.push(event);
    cases.set(event.caseId, list);
  }

  const nodeStats = new Map<
    string,
    {
      eventCount: number;
      caseIds: Set<string>;
      reworkCount: number;
      incomingWaitTotal: number;
      incomingWaitCount: number;
    }
  >();
  const edgeStats = new Map<string, { source: string; target: string; count: number; waitTotal: number }>();
  const variantStats = new Map<string, { path: string[]; caseCount: number }>();
  const cycleTimes: number[] = [];
  let casesWithRework = 0;

  for (const [caseId, caseEvents] of cases) {
    const ordered = [...caseEvents].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    if (!ordered.length) continue;

    const activityCounts = new Map<string, number>();
    let hasRework = false;

    for (const event of ordered) {
      activityCounts.set(event.activity, (activityCounts.get(event.activity) ?? 0) + 1);
      const node = nodeStats.get(event.activity) ?? {
        eventCount: 0,
        caseIds: new Set<string>(),
        reworkCount: 0,
        incomingWaitTotal: 0,
        incomingWaitCount: 0,
      };
      node.eventCount += 1;
      node.caseIds.add(caseId);
      nodeStats.set(event.activity, node);
    }

    for (const [activity, count] of activityCounts) {
      if (count > 1) {
        hasRework = true;
        const node = nodeStats.get(activity)!;
        node.reworkCount += count - 1;
      }
    }
    if (hasRework) casesWithRework += 1;

    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      const waitSeconds = toSeconds(Date.parse(current.timestamp) - Date.parse(previous.timestamp));
      const key = `${previous.activity}→${current.activity}`;
      const edge = edgeStats.get(key) ?? {
        source: previous.activity,
        target: current.activity,
        count: 0,
        waitTotal: 0,
      };
      edge.count += 1;
      edge.waitTotal += waitSeconds;
      edgeStats.set(key, edge);

      const targetNode = nodeStats.get(current.activity)!;
      targetNode.incomingWaitTotal += waitSeconds;
      targetNode.incomingWaitCount += 1;
    }

    const cycle = toSeconds(
      Date.parse(ordered[ordered.length - 1].timestamp) - Date.parse(ordered[0].timestamp),
    );
    cycleTimes.push(cycle);

    const path = ordered.map((event) => event.activity);
    const key = path.join("→");
    const variant = variantStats.get(key) ?? { path, caseCount: 0 };
    variant.caseCount += 1;
    variantStats.set(key, variant);
  }

  const nodes: ProcessNode[] = [...nodeStats.entries()]
    .map(([activity, stats]) => ({
      activity,
      eventCount: stats.eventCount,
      caseCount: stats.caseIds.size,
      reworkCount: stats.reworkCount,
      avgIncomingWaitSeconds:
        stats.incomingWaitCount > 0 ? stats.incomingWaitTotal / stats.incomingWaitCount : 0,
    }))
    .sort((a, b) => b.eventCount - a.eventCount);

  const edges: ProcessEdge[] = [...edgeStats.values()]
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      count: edge.count,
      avgWaitSeconds: edge.count ? edge.waitTotal / edge.count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const variants: ProcessVariant[] = [...variantStats.values()].sort(
    (a, b) => b.caseCount - a.caseCount,
  );

  const avgCycleSeconds =
    cycleTimes.length > 0
      ? cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length
      : 0;

  return {
    nodes,
    edges,
    variants,
    metrics: {
      caseCount: cases.size,
      eventCount: events.length,
      avgCycleSeconds,
      p95CycleSeconds: percentile(cycleTimes, 0.95),
      reworkRatePct: cases.size ? (casesWithRework / cases.size) * 100 : 0,
    },
  };
}
