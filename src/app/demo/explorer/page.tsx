import { runCoreCycle } from "@/core/process/cycle";
import { demoEvents, demoScenario } from "@/data/demo-process";
import { ProcessExplorer } from "@/features/process-explorer/process-explorer";
import type { ProcessExplorerData } from "@/features/process-explorer/types";

export default function DemoExplorerPage() {
  const analysis = runCoreCycle(demoEvents, demoScenario);
  const data: ProcessExplorerData = {
    process: {
      id: "demo-process",
      name: "Processo de Pedidos — Demo",
      status: "active",
    },
    dataset: {
      id: "demo-dataset",
      name: "demo-process",
      originalFilename: "demo-process.csv",
      createdAt: "2026-09-15T08:00:00.000Z",
    },
    analysis: {
      id: "demo-analysis",
      createdAt: "2026-09-15T18:00:00.000Z",
      completedAt: "2026-09-15T18:00:00.000Z",
    },
    model: analysis.model,
    bottlenecks: analysis.bottleneck ? [analysis.bottleneck] : [],
  };

  return (
    <main className="explorer-page">
      <ProcessExplorer data={data} />
    </main>
  );
}
