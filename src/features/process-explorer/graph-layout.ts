import type { ProcessNode, ProcessVariant } from "@/core/process/types";
import type { PositionedNode } from "./types";

const NODE_WIDTH = 190;
const NODE_HEIGHT = 104;
const COLUMN_GAP = 100;
const ROW_GAP = 34;
const PADDING = 36;

type WeightedPosition = {
  total: number;
  weight: number;
};

export function layoutProcessNodes(
  nodes: readonly ProcessNode[],
  variants: readonly ProcessVariant[],
): { nodes: PositionedNode[]; width: number; height: number } {
  if (!nodes.length) {
    return { nodes: [], width: 0, height: 0 };
  }

  const positions = new Map<string, WeightedPosition>();

  for (const variant of variants) {
    const firstIndex = new Map<string, number>();
    variant.path.forEach((activity, index) => {
      if (!firstIndex.has(activity)) firstIndex.set(activity, index);
    });

    for (const [activity, index] of firstIndex) {
      const current = positions.get(activity) ?? { total: 0, weight: 0 };
      current.total += index * Math.max(1, variant.caseCount);
      current.weight += Math.max(1, variant.caseCount);
      positions.set(activity, current);
    }
  }

  const ranked = nodes.map((node) => {
    const position = positions.get(node.activity);
    const average = position?.weight ? position.total / position.weight : 0;
    return { node, average };
  });

  const averages = [...new Set(ranked.map((item) => item.average))]
    .sort((a, b) => a - b);

  const groups = new Map<number, ProcessNode[]>();
  for (const item of ranked) {
    const column = averages.findIndex((value) => value === item.average);
    const list = groups.get(column) ?? [];
    list.push(item.node);
    groups.set(column, list);
  }

  for (const list of groups.values()) {
    list.sort(
      (a, b) =>
        b.caseCount - a.caseCount ||
        a.activity.localeCompare(b.activity, "pt-BR"),
    );
  }

  const maxRows = Math.max(...[...groups.values()].map((list) => list.length), 1);
  const height =
    PADDING * 2 + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP;
  const width =
    PADDING * 2 +
    averages.length * NODE_WIDTH +
    Math.max(0, averages.length - 1) * COLUMN_GAP;

  const positioned: PositionedNode[] = [];

  for (const [column, list] of groups) {
    const contentHeight =
      list.length * NODE_HEIGHT + Math.max(0, list.length - 1) * ROW_GAP;
    const startY = Math.max(PADDING, (height - contentHeight) / 2);

    list.forEach((node, row) => {
      positioned.push({
        ...node,
        x: PADDING + column * (NODE_WIDTH + COLUMN_GAP),
        y: startY + row * (NODE_HEIGHT + ROW_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });
  }

  positioned.sort((a, b) => a.x - b.x || a.y - b.y || a.activity.localeCompare(b.activity, "pt-BR"));

  return { nodes: positioned, width, height };
}
