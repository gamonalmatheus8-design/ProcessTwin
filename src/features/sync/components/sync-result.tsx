import Link from "next/link";
import type { SyncResponse } from "../types";
import { analysisStateLabel, syncStateLabel } from "../presentation";

export function SyncResult({ result, explorerHref, onRetryAnalysis }: { result: SyncResponse; explorerHref: string; onRetryAnalysis?: () => void }) {
  return <section className="panel" aria-live="polite">
    <span className="eyebrow">CSV recorrente · {syncStateLabel(result.run.status)}</span><h2>{result.message}</h2>
    <div className="result-grid">{[
      ["Registros recebidos", result.run.fetched_count], ["Novos", result.run.accepted_count], ["Atualizados", result.run.updated_count],
      ["Duplicados ignorados", result.run.duplicate_count], ["Inválidos", result.run.invalid_count], ["Alterações no processo", result.run.accepted_count + result.run.updated_count],
    ].map(([label, count]) => <article className="metric" key={String(label)}><span>{label}</span><strong>{Number(count).toLocaleString("pt-BR")}</strong></article>)}</div>
    <p>Nova análise executada: <strong>{result.analysisExecuted ? "Sim" : "Não"}</strong> · {analysisStateLabel(result.run.analysis_status)}</p>
    {result.run.status === "failed" && <p>Os eventos já salvos foram preservados. {result.run.error_message?.includes("mapeamento") ? "Restaure as colunas esperadas na exportação e sincronize novamente; o mapeamento salvo permanece o mesmo." : "Consulte o motivo no histórico e tente novamente após corrigir o problema."}</p>}
    {result.run.status === "partial" && <p>Os {result.run.invalid_count} registros inválidos não foram incorporados. Corrija-os na origem e envie uma nova exportação.</p>}
    <div className="actions">{onRetryAnalysis && ["failed", "pending", "superseded"].includes(result.run.analysis_status) && <button className="button secondary" type="button" onClick={onRetryAnalysis}>Executar análise novamente</button>}
      {result.run.status !== "failed" && <Link className="button" href={explorerHref}>Abrir Process Explorer</Link>}</div>
  </section>;
}
