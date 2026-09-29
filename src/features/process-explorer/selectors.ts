import type {
  Bottleneck,
  ProcessEdge,
  ProcessNode,
  ProcessVariant,
} from "@/core/process/types";
import type { ActivityHealth } from "./types";
import { formatDuration } from "./formatters";

export const edgeKey = (source: string, target: string) =>
  `${source}\u0000${target}`;

export function getActivityCoveragePct(node: ProcessNode, totalCases: number) {
  return totalCases > 0 ? (node.caseCount / totalCases) * 100 : 0;
}

export function getActivityReworkPct(node: ProcessNode) {
  return node.eventCount > 0 ? (node.reworkCount / node.eventCount) * 100 : 0;
}

export function getVariantPct(variant: ProcessVariant, totalCases: number) {
  return totalCases > 0 ? (variant.caseCount / totalCases) * 100 : 0;
}

export function sortVariants(variants: readonly ProcessVariant[]) {
  return [...variants].sort(
    (left, right) =>
      right.caseCount - left.caseCount ||
      left.path.join("→").localeCompare(right.path.join("→"), "pt-BR"),
  );
}

export function getVariantEdgeKeys(variant: ProcessVariant | null) {
  const keys = new Set<string>();
  if (!variant) return keys;
  for (let index = 1; index < variant.path.length; index += 1) {
    keys.add(edgeKey(variant.path[index - 1], variant.path[index]));
  }
  return keys;
}

export function classifyActivityHealth(
  node: ProcessNode,
  nodes: readonly ProcessNode[],
  bottleneck?: Bottleneck | null,
): ActivityHealth {
  if (bottleneck?.activity === node.activity) return "critical";

  const waits = nodes
    .map((item) => item.avgIncomingWaitSeconds)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!waits.length || node.avgIncomingWaitSeconds <= 0) return "healthy";

  const max = waits[waits.length - 1] || 1;
  const ratio = node.avgIncomingWaitSeconds / max;

  if (ratio >= 0.75) return "critical";
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.25) return "attention";
  return "healthy";
}

export function getTopReworkNode(nodes: readonly ProcessNode[]) {
  return [...nodes]
    .filter((node) => node.reworkCount > 0)
    .sort(
      (a, b) =>
        b.reworkCount - a.reworkCount ||
        a.activity.localeCompare(b.activity, "pt-BR"),
    )[0] ?? null;
}

export function buildExecutiveInsight(
  nodes: readonly ProcessNode[],
  bottleneck: Bottleneck | null,
  totalCases: number,
) {
  if (!bottleneck) {
    return "Nenhum gargalo principal foi identificado na análise mais recente.";
  }

  const node = nodes.find((item) => item.activity === bottleneck.activity);
  const coverage = node ? getActivityCoveragePct(node, totalCases) : 0;
  const rework = getTopReworkNode(nodes);

  let sentence =
    `Principal gargalo: ${bottleneck.activity}. ` +
    `A etapa apresenta intervalo médio observado de ${formatDuration(bottleneck.avgWaitSeconds)} ` +
    `e está presente em ${coverage.toFixed(0)}% dos cases analisados.`;

  if (rework) {
    sentence += ` O maior retrabalho aparece em ${rework.activity}, com ${rework.reworkCount} ocorrência(s) adicional(is).`;
  }

  return sentence;
}

export function getEdgeVolumePct(edge: ProcessEdge, totalCases: number) {
  return totalCases > 0 ? (edge.count / totalCases) * 100 : 0;
}
