import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProcessExplorer } from "@/features/process-explorer/process-explorer";
import { getLatestProcessExplorerData } from "@/features/process-explorer/data";

export default async function ProcessExplorerPage({
  params,
}: {
  params: Promise<{ processId: string }>;
}) {
  const { processId } = await params;
  const result = await getLatestProcessExplorerData(processId);

  if (result.kind === "not-found") notFound();

  if (result.kind === "error") {
    return (
      <AppShell active="explorer" processId={processId} wide>
        <section className="panel empty-state">
          <span className="eyebrow">Process Explorer</span>
          <h1>Não foi possível carregar o Explorer</h1>
          <p>O processo existe, mas a análise mais recente não pôde ser carregada agora.</p>
          <Link className="button secondary" href="/processes/new">Voltar para importação</Link>
        </section>
      </AppShell>
    );
  }

  if (result.kind === "no-analysis") {
    return (
      <AppShell active="explorer" processId={processId} processName={result.process.name} wide>
        <section className="panel empty-state">
          <span className="eyebrow">Process Explorer</span>
          <h1>{result.process.name}</h1>
          <p>Este processo ainda não possui uma análise disponível.</p>
          <Link className="button" href="/processes/new">Importar dados</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell active="explorer" processId={processId} processName={result.data.process.name} eyebrow="Analyze / Process Explorer" wide>
      <div className="explorer-page"><ProcessExplorer data={result.data} /></div>
    </AppShell>
  );
}
