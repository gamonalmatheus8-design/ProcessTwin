import { describe, expect, it } from "vitest";
import type { ProcessNode, ProcessVariant } from "@/core/process/types";
import { layoutProcessNodes } from "./graph-layout";

const nodes: ProcessNode[] = [
  { activity: "A", eventCount: 3, caseCount: 3, reworkCount: 0, avgIncomingWaitSeconds: 0 },
  { activity: "B", eventCount: 3, caseCount: 3, reworkCount: 0, avgIncomingWaitSeconds: 60 },
  { activity: "C", eventCount: 3, caseCount: 3, reworkCount: 0, avgIncomingWaitSeconds: 120 },
];

const variants: ProcessVariant[] = [
  { path: ["A", "B", "C"], caseCount: 3 },
];

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

  it("returns a safe empty layout", () => {
    expect(layoutProcessNodes([], [])).toEqual({ nodes: [], width: 0, height: 0 });
  });
});
