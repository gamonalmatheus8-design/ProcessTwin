import { runCoreCycle } from "@/core/process/cycle";
import { demoEvents, demoScenario } from "@/data/demo-process";
import { SimulationLab } from "@/features/simulation-lab/simulation-lab";
import type { SimulationLabData } from "@/features/simulation-lab/types";

export default async function DemoSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedActivity =
    typeof query.activity === "string" ? query.activity : query.activity?.[0];
  const analysis = runCoreCycle(demoEvents, demoScenario);
  const primaryBottleneck = analysis.bottleneck;
  const initialActivity =
    analysis.model.nodes.find((node) => node.activity === requestedActivity)?.activity ??
    primaryBottleneck?.activity ??
    analysis.model.nodes[0]?.activity ??
    "";
  const data: SimulationLabData = {
    process: { id: "demo", name: "Processo de Pedidos — Demo", status: "demo" },
    dataset: { id: "demo", name: "demo-process", originalFilename: "demo-process.csv" },
    analysis: {
      id: "demo",
      createdAt: "2026-09-15T18:00:00.000Z",
      completedAt: "2026-09-15T18:00:00.000Z",
    },
    activities: analysis.model.nodes,
    primaryBottleneck,
    initialActivity,
    canRun: true,
    history: [],
  };

  return (
    <main className="simulation-page">
      <SimulationLab data={data} demo executionUrl="/api/demo-simulation" />
    </main>
  );
}
