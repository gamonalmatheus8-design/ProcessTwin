import Link from "next/link";
import type { SyncResponse } from "../types";

export function SyncResult({ result, explorerHref, onRetryAnalysis }: { result: SyncResponse; explorerHref: string; onRetryAnalysis?: () => void }) {
  return <section className="panel" aria-live="polite">
    <span className="eyebrow">CSV recorrente · {result.run.status}</span><h2>{result.message}</h2>
    <div className="result-grid">{[
      ["Registros recebidos", result.run.fetched_count], ["Novos", result.run.accepted_count], ["Atualizados", result.run.updated_count],
      ["Duplicados ignorados", result.run.duplicate_count], ["Inválidos", result.run.invalid_count], ["Alterações no processo", result.run.accepted_count + result.run.updated_count],
    ].map(([label, count]) => <article className="metric" key={String(label)}><span>{label}</span><strong>{Number(count).toLocaleString("pt-BR")}</strong></article>)}</div>
    <p>Nova análise executada: <strong>{result.analysisExecuted ? "Sim" : "Não"}</strong> · Estado: {result.run.analysis_status}</p>
    <div className="actions">{onRetryAnalysis && ["failed", "pending", "superseded"].includes(result.run.analysis_status) && <button className="button secondary" type="button" onClick={onRetryAnalysis}>Executar análise novamente</button>}
      {result.run.status !== "failed" && <Link className="button" href={explorerHref}>Abrir Process Explorer</Link>}</div>
  </section>;
}
