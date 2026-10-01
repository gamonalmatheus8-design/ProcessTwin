import Link from "next/link";
import { notFound } from "next/navigation";
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
      <main className="app-shell">
        <section className="panel empty-state">
          <span className="eyebrow">ProcessTwin AI</span>
          <h1>Não foi possível carregar o Explorer</h1>
          <p>O processo existe, mas a análise mais recente não pôde ser carregada agora.</p>
          <div className="actions">
            <Link className="button secondary" href="/processes/new">Voltar para importação</Link>
          </div>
        </section>
      </main>
    );
  }

  if (result.kind === "no-analysis") {
    return (
      <main className="app-shell">
        <section className="panel empty-state">
          <span className="eyebrow">Process Explorer</span>
          <h1>{result.process.name}</h1>
          <p>Este processo ainda não possui uma análise disponível.</p>
          <Link className="button" href="/processes/new">Importar dados</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="explorer-page">
      <nav className="actions process-navigation" aria-label="Navegação do processo">
        <Link className="button secondary" href={`/processes/${processId}`}>Visão do processo</Link>
        <Link className="button secondary" href={`/processes/${processId}/connectors`}>Conectores</Link>
        <Link className="button secondary" href="/processes/new">Importar dados</Link>
      </nav>
      <ProcessExplorer data={result.data} />
    </main>
  );
}
