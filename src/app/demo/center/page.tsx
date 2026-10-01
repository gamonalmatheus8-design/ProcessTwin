import { AppShell } from "@/components/layout/app-shell";
import { DemoCenter } from "@/features/demo-center/demo-center";
import { demoIds } from "@/features/demo-center/datasets";
import { getDemo } from "@/features/demo-center/model";

export const metadata = {
  title: "Demonstrações | ProcessTwin AI",
  description: "Explore matrículas, mensalidades e chamados com dados sintéticos e o motor real do ProcessTwin.",
};

export default function DemoCenterPage() {
  const scenarios = demoIds.map((id) => {
    const { dataset, result } = getDemo(id);
    return {
      id,
      sector: dataset.sector,
      organization: dataset.organization,
      name: dataset.name,
      description: dataset.description,
      cases: result.metrics.caseCount,
      events: result.metrics.eventCount,
      rework: result.metrics.reworkRatePct,
      avgCycle: result.metrics.avgCycleSeconds,
    };
  });

  return (
    <AppShell active="demos" eyebrow="Demo workspace" wide>
      <DemoCenter scenarios={scenarios} />
    </AppShell>
  );
}
