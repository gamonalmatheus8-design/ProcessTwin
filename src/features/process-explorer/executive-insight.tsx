import type { Bottleneck, ProcessNode } from "@/core/process/types";
import { buildExecutiveInsight } from "./selectors";

export function ExecutiveInsight({
  nodes,
  bottleneck,
  totalCases,
}: {
  nodes: ProcessNode[];
  bottleneck: Bottleneck | null;
  totalCases: number;
}) {
  return (
    <section className="executive-insight">
      <span className="eyebrow">Leitura executiva</span>
      <p>{buildExecutiveInsight(nodes, bottleneck, totalCases)}</p>
    </section>
  );
}
