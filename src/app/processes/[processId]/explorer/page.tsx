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
      <ProcessExplorer data={result.data} />
    </main>
  );
}
