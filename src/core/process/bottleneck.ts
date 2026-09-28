import type { Bottleneck, ProcessModel } from "./types";

const severityFor = (score: number): Bottleneck["severity"] => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
};

export function findPrimaryBottleneck(model: ProcessModel): Bottleneck | null {
  if (!model.nodes.length || !model.metrics.caseCount) return null;

  const maxWait = Math.max(...model.nodes.map((node) => node.avgIncomingWaitSeconds), 1);

  const candidates = model.nodes.map((node) => {
    const waitWeight = node.avgIncomingWaitSeconds / maxWait;
    const volumeWeight = node.caseCount / model.metrics.caseCount;
    const reworkRatePct = node.eventCount
      ? (node.reworkCount / node.eventCount) * 100
      : 0;
    const reworkWeight = Math.min(1, reworkRatePct / 50);

    const score = Math.min(
      100,
      Math.round((waitWeight * 0.6 + volumeWeight * 0.25 + reworkWeight * 0.15) * 100),
    );

    return {
      activity: node.activity,
      score,
      severity: severityFor(score),
      avgWaitSeconds: Math.round(node.avgIncomingWaitSeconds),
      affectedCases: node.caseCount,
      reworkRatePct: Number(reworkRatePct.toFixed(2)),
      evidence: {
        waitWeight: Number(waitWeight.toFixed(3)),
        volumeWeight: Number(volumeWeight.toFixed(3)),
        reworkWeight: Number(reworkWeight.toFixed(3)),
      },
    } satisfies Bottleneck;
  });

  return candidates.sort(
    (a, b) => b.score - a.score || a.activity.localeCompare(b.activity, "pt-BR"),
  )[0] ?? null;
}
