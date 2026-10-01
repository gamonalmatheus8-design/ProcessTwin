"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/features/process-explorer/formatters";
import type { ConnectorCard, SyncResponse, SyncRun } from "../types";
import { ConnectorSetup } from "./connector-setup";
import { SyncResult } from "./sync-result";
import { analysisStateLabel, syncStateLabel } from "../presentation";

export function ConnectorCenter({ processId, processName, connectors, runs, canManage }: { processId: string; processName: string; connectors: ConnectorCard[]; runs: SyncRun[]; canManage: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState(false);
  const [uploadTo, setUploadTo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  function receive(value: SyncResponse) { setResult(value); router.refresh(); }
  async function send(form: FormData) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/connectors`, { method: "POST", body: form });
      const value = await response.json();
      if (value.run) { receive(value); setUploadTo(null); setFile(null); } else setError(value.error ?? "Não foi possível sincronizar.");
    } catch { setError("Conexão interrompida. Atualize o histórico antes de reenviar."); }
    finally { setBusy(false); router.refresh(); }
  }
  function resync() { if (!uploadTo || !file || busy) return; const form = new FormData(); form.set("connectorId", uploadTo); form.set("file", file); void send(form); }
  function retry(runId: string) { if (busy) return; const form = new FormData(); form.set("action", "analysis"); form.set("runId", runId); void send(form); }
  const history = historyFor ? runs.filter((run) => run.connector_id === historyFor) : runs;
  return <main className="app-shell result-stack" aria-busy={busy}>
    <header className="page-header"><div><span className="eyebrow">{processName} · Conectores</span><h1>Fontes do processo</h1><p>Conecte uma exportação recorrente e mantenha seu processo atualizado.</p></div><div className="actions"><Link className="button secondary" href="/pilot">Guia do piloto</Link><Link className="button secondary" href={`/processes/${processId}`}>Voltar ao processo</Link></div></header>
    <section className="panel"><h2>Fontes disponíveis</h2><div className="sync-source-grid"><button className="pack-card" type="button" disabled={!canManage || busy} onClick={() => { setSetup(true); setResult(null); }}><strong>CSV recorrente</strong><span>Envie novas exportações com identidade e mapeamento estáveis.</span><small>Conectar · Manual</small></button>{["Google Sheets", "REST API", "Webhook", "Banco SQL"].map((source) => <article className="pack-card unavailable" key={source}><strong>{source}</strong><span>Em breve</span></article>)}</div>{!canManage && <p>Owner/Admin pode criar e sincronizar conectores. Você pode consultar os dados e o histórico.</p>}</section>
    {setup && <ConnectorSetup processId={processId} onClose={() => setSetup(false)} onResult={receive} />}
    {connectors.map((connector) => <section className="panel" key={connector.id}><span className="eyebrow">{connector.type === "recurring_csv" ? "CSV recorrente" : connector.type} · {syncStateLabel(connector.status)}</span><h2>{connector.name}</h2><dl className="sync-review"><dt>Dataset</dt><dd>{connector.datasetName}</dd><dt>Última sincronização</dt><dd>{connector.lastSync ? formatDateTime(connector.lastSync) : "Ainda não executada"}</dd><dt>Último sucesso</dt><dd>{connector.lastSuccess ? formatDateTime(connector.lastSuccess) : "Ainda não executada"}</dd><dt>Próxima sincronização</dt><dd>Manual · envie um novo arquivo</dd><dt>Total de runs</dt><dd>{connector.totalRuns}</dd></dl><div className="actions"><a className="button secondary" href="#sync-history" onClick={() => setHistoryFor(connector.id)}>Ver histórico</a>{canManage && connector.type === "recurring_csv" && <button className="button" type="button" disabled={busy || ["paused", "disabled", "needs_reauth"].includes(connector.status)} onClick={() => { setUploadTo(connector.id); setFile(null); setResult(null); }}>Sincronizar novamente</button>}</div></section>)}
    {uploadTo && <section className="panel"><h2>Sincronizar novamente</h2><p>O mesmo mapeamento e a mesma identidade serão aplicados. Se uma coluna configurada estiver ausente, o arquivo será interrompido sem alterar os eventos salvos.</p><label>Novo CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { const selected = event.target.files?.[0]; setFile(null); setError(""); if (selected && (!selected.name.toLowerCase().endsWith(".csv") || !selected.size || selected.size > 4 * 1024 * 1024)) { setError("Selecione um CSV entre 1 byte e 4 MB."); return; } setFile(selected ?? null); }} /></label><div className="actions"><button className="button secondary" disabled={busy} onClick={() => setUploadTo(null)}>Cancelar</button><button className="button" disabled={!file || busy} onClick={resync}>{busy ? "Sincronizando…" : "Sincronizar CSV"}</button></div></section>}
    {error && <p role="alert" className="error-banner">{error}</p>}
    {result && <SyncResult result={result} explorerHref={`/processes/${processId}/explorer`} onRetryAnalysis={canManage && !busy ? () => retry(result.run.id) : undefined} />}
    <section className="panel" id="sync-history"><h2>Histórico de sincronizações</h2><p>Últimas 50 execuções, da mais recente para a mais antiga.</p>{historyFor && <button className="button secondary" onClick={() => setHistoryFor(null)}>Todos os conectores</button>}<div className="sync-table"><table><thead><tr>{["Data", "Status", "Arquivo", "Recebidos", "Novos", "Atualizados", "Duplicados", "Inválidos", "Análise"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{history.map((run) => <tr key={run.id}><td>{run.started_at ? formatDateTime(run.started_at) : "—"}</td><td>{syncStateLabel(run.status)}{run.error_message && <small>{run.error_message}</small>}</td><td>{run.filename ?? "—"}</td><td>{run.fetched_count}</td><td>{run.accepted_count}</td><td>{run.updated_count}</td><td>{run.duplicate_count}</td><td>{run.invalid_count}</td><td>{analysisStateLabel(run.analysis_status)}{canManage && ["failed", "pending"].includes(run.analysis_status) && <button disabled={busy} className="button secondary" onClick={() => retry(run.id)}>Reanalisar</button>}</td></tr>)}</tbody></table></div>{!history.length && <p>Nenhuma sincronização registrada.</p>}</section>
  </main>;
}
