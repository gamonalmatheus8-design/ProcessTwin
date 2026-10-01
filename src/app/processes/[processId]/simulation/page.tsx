import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SimulationLab } from "@/features/simulation-lab/simulation-lab";
import { getSimulationLabData } from "@/features/simulation-lab/data";

export default async function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ processId: string }>;
  searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const [{ processId }, query] = await Promise.all([params, searchParams]);
  const requestedActivity = typeof query.activity === "string" ? query.activity : query.activity?.[0];
  const loadResult = await getSimulationLabData(processId, requestedActivity);

  if (loadResult.kind === "not-found") notFound();

  if (loadResult.kind === "error" || loadResult.kind === "no-analysis") {
    return (
      <AppShell active="simulation" processId={processId} processName={loadResult.process.name} wide>
        <section className="panel empty-state">
          <span className="eyebrow">Simulation Lab</span>
          <h1>{loadResult.process.name}</h1>
          <p>{loadResult.kind === "no-analysis" ? "Este processo ainda não possui uma análise concluída para servir de baseline." : "Não foi possível carregar os dados da simulação agora."}</p>
          <Link className="button secondary" href={`/processes/${processId}/explorer`}>Voltar ao Process Explorer</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell active="simulation" processId={processId} processName={loadResult.data.process.name} eyebrow="Analyze / Simulation Lab" wide>
      <div className="simulation-page">
        <SimulationLab data={loadResult.data} executionUrl={`/api/processes/${processId}/simulation`} />
      </div>
    </AppShell>
  );
}
