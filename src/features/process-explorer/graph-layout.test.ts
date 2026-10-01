import { describe, expect, it } from "vitest";
import type { ProcessNode, ProcessVariant } from "@/core/process/types";
import { layoutProcessNodes } from "./graph-layout";

const nodes: ProcessNode[] = [
  {
    activity: "A",
    eventCount: 3,
    caseCount: 3,
    reworkCount: 0,
    avgIncomingWaitSeconds: 0,
  },
  {
    activity: "B",
    eventCount: 3,
    caseCount: 3,
    reworkCount: 0,
    avgIncomingWaitSeconds: 60,
  },
  {
    activity: "C",
    eventCount: 3,
    caseCount: 3,
    reworkCount: 0,
    avgIncomingWaitSeconds: 120,
  },
];

const variants: ProcessVariant[] = [{ path: ["A", "B", "C"], caseCount: 3 }];

describe("layoutProcessNodes", () => {
  it("lays out the main flow from left to right", () => {
    const result = layoutProcessNodes(nodes, variants);
    const a = result.nodes.find((node) => node.activity === "A")!;
    const b = result.nodes.find((node) => node.activity === "B")!;
    const c = result.nodes.find((node) => node.activity === "C")!;
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
  });

  it("is deterministic regardless of input node order", () => {
    const first = layoutProcessNodes(nodes, variants);
    const second = layoutProcessNodes([...nodes].reverse(), variants);
    expect(second).toEqual(first);
  });

  it.each([1, 2, 3])(
    "wraps to %s columns without hiding nodes or overlapping them",
    (columns) => {
      const layout = layoutProcessNodes(nodes, variants, columns);
      expect(layout.nodes.map((node) => node.activity)).toEqual([
        "A",
        "B",
        "C",
      ]);
      for (const node of layout.nodes) {
        expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
        expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
      }
      for (let i = 0; i < layout.nodes.length; i++)
        for (let j = i + 1; j < layout.nodes.length; j++) {
          const a = layout.nodes[i],
            b = layout.nodes[j];
          expect(
            a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
          ).toBe(true);
        }
      expect(
        layoutProcessNodes([...nodes].reverse(), variants, columns),
      ).toEqual(layout);
    },
  );
  it("returns a safe empty layout", () => {
    expect(layoutProcessNodes([], [])).toEqual({
      nodes: [],
      width: 0,
      height: 0,
    });
  });
});
