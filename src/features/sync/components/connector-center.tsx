"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/features/process-explorer/formatters";
import type { ConnectorCard, SyncResponse, SyncRun } from "../types";
import { SheetsSetup } from "./sheets-setup";
import { ConnectorSetup } from "./connector-setup";
import { SyncResult } from "./sync-result";
import { analysisStateLabel, syncStateLabel } from "../presentation";

export function ConnectorCenter({
  processId,
  processName,
  connectors,
  runs,
  canManage,
  sheetsAvailable = false,
  googleNotice,
}: {
  processId: string;
  processName: string;
  connectors: ConnectorCard[];
  runs: SyncRun[];
  canManage: boolean;
  sheetsAvailable?: boolean;
  googleNotice?: string;
}) {
  const router = useRouter();
  const [sheetsSetup, setSheetsSetup] = useState<string | null>(
    googleNotice ? "new" : null,
  );
  const [setup, setSetup] = useState(false);
  const [uploadTo, setUploadTo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  function receive(value: SyncResponse) {
    setResult(value);
    router.refresh();
  }
  async function send(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/connectors`, {
        method: "POST",
        body: form,
      });
      const value = await response.json();
      if (value.run) {
        receive(value);
        setUploadTo(null);
        setFile(null);
      } else setError(value.error ?? "Não foi possível sincronizar.");
    } catch {
      setError("Conexão interrompida. Atualize o histórico antes de reenviar.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  function resync() {
    if (!uploadTo || !file || busy) return;
    const form = new FormData();
    form.set("connectorId", uploadTo);
    form.set("file", file);
    void send(form);
  }
  async function sheetsAction(
    action: string,
    connectorId: string,
    runId?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, connectorId, runId }),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Não foi possível concluir a operação.");
      if (value.datasetId && value.run) receive(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  function retry(runId: string) {
    const run = runs.find((item) => item.id === runId);
    if (
      run &&
      connectors.find((item) => item.id === run.connector_id)?.type ===
        "google_sheets"
    ) {
      void sheetsAction("analysis", run.connector_id, runId);
      return;
    }
    if (busy) return;
    const form = new FormData();
    form.set("action", "analysis");
    form.set("runId", runId);
    void send(form);
  }
  const history = historyFor
    ? runs.filter((run) => run.connector_id === historyFor)
    : runs;
  return (
    <div className="pt-connector-center" aria-busy={busy}>
      <header className="pt-page-heading">
        <div>
          <span className="eyebrow">Fontes de dados</span>
          <h1>Fontes do processo</h1>
          <p>
            Conecte fontes operacionais, acompanhe a saúde da sincronização e
            mantenha o dataset vivo sem misturar configuração com análise.
          </p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/pilot">Guia do piloto</Link>
          <Link className="button secondary" href={`/processes/${processId}`}>Overview</Link>
        </div>
      </header>

      <section className="pt-dashboard-panel">
        <div className="pt-section-title">
          <div>
            <span className="eyebrow">Nova fonte</span>
            <h2>Conectar nova fonte</h2>
          </div>
          <p>Integrações futuras permanecem visíveis sem competir com fontes ativas.</p>
        </div>
        <div className="pt-connector-catalog">
          <button
            className="pt-source-tile"
            type="button"
            disabled={!canManage || busy}
            onClick={() => { setSetup(true); setResult(null); }}
          >
            <strong>CSV recorrente</strong>
            <span>Atualizações manuais com identidade e mapeamento estáveis.</span>
            <small>Conectar · Manual</small>
          </button>
          <button
            className="pt-source-tile"
            type="button"
            disabled={!canManage || busy}
            onClick={() => { setSheetsSetup("new"); setResult(null); }}
          >
            <strong>Google Sheets</strong>
            <span>Planilha privada com sincronização manual ou diária.</span>
            <small>Conectar · OAuth</small>
          </button>
          {["REST API", "Webhook", "Banco SQL"].map((source) => (
            <article className="pt-source-tile unavailable" key={source}>
              <strong>{source}</strong>
              <span>Integração planejada para uma próxima versão.</span>
              <small>Em breve</small>
            </article>
          ))}
        </div>
        {!canManage && (
          <p>Owner/Admin pode criar e sincronizar conectores. Seu perfil mantém acesso de leitura ao histórico.</p>
        )}
      </section>

      {sheetsSetup && (
        <SheetsSetup
          key={sheetsSetup}
          processId={processId}
          connectorId={sheetsSetup === "new" ? undefined : sheetsSetup}
          available={sheetsAvailable}
          notice={googleNotice}
          onResult={receive}
          onClose={() => setSheetsSetup(null)}
        />
      )}
      {setup && (
        <ConnectorSetup
          processId={processId}
          onClose={() => setSetup(false)}
          onResult={receive}
        />
      )}

      <section>
        <div className="pt-section-title">
          <div>
            <span className="eyebrow">Status operacional</span>
            <h2>Fontes conectadas</h2>
          </div>
          <p>{connectors.length} fonte(s) configurada(s)</p>
        </div>

        {connectors.length ? (
          <div className="pt-connector-list">
            {connectors.map((connector) => (
              <article className="pt-connector-row" key={connector.id}>
                <div className="pt-connector-name">
                  <strong>{connector.name}</strong>
                  <span>
                    <i className={`pt-status-dot ${connector.status}`} />
                    {connector.type === "recurring_csv"
                      ? "CSV recorrente"
                      : connector.type === "google_sheets"
                        ? "Google Sheets"
                        : connector.type}
                    {" · "}
                    {syncStateLabel(connector.status)}
                  </span>
                </div>
                <div className="pt-connector-meta">
                  <span>Dataset</span>
                  <strong>{connector.datasetName}</strong>
                </div>
                <div className="pt-connector-meta">
                  <span>Última sincronização</span>
                  <strong>{connector.lastSync ? formatDateTime(connector.lastSync) : "Ainda não executada"}</strong>
                </div>
                <div className="pt-connector-meta">
                  <span>Próxima sincronização</span>
                  <strong>
                    {connector.type === "google_sheets"
                      ? ["paused", "needs_attention", "needs_reauth"].includes(connector.status)
                        ? "Pausada · revisar"
                        : connector.nextSync
                          ? formatDateTime(connector.nextSync)
                          : "Manual"
                      : "Manual"}
                  </strong>
                </div>
                <div className="pt-connector-actions">
                  <a className="button secondary compact" href="#sync-history" onClick={() => setHistoryFor(connector.id)}>
                    Histórico
                  </a>
                  {canManage && connector.type === "recurring_csv" && (
                    <button
                      className="button compact"
                      type="button"
                      disabled={busy || ["paused", "disabled", "needs_reauth"].includes(connector.status)}
                      onClick={() => { setUploadTo(connector.id); setFile(null); setResult(null); }}
                    >
                      Sincronizar
                    </button>
                  )}
                  {canManage && connector.type === "google_sheets" && (
                    <>
                      <button
                        className="button compact"
                        disabled={busy || !["draft", "active"].includes(connector.status)}
                        onClick={() => void sheetsAction("sync", connector.id)}
                      >
                        Sync now
                      </button>
                      <button
                        className="button secondary compact"
                        disabled={busy}
                        onClick={() => setSheetsSetup(connector.id)}
                      >
                        Revisar
                      </button>
                      {connector.status === "active" && (
                        <button
                          className="button secondary compact"
                          disabled={busy}
                          onClick={() => void sheetsAction("pause", connector.id)}
                        >
                          Pausar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            <span className="eyebrow">Nenhuma fonte conectada</span>
            <h2>Conecte a primeira fonte operacional</h2>
            <p>CSV recorrente e Google Sheets já podem manter um dataset vivo para este processo.</p>
          </div>
        )}
      </section>

      {uploadTo && (
        <section className="panel">
          <span className="eyebrow">CSV recorrente</span>
          <h2>Sincronizar novamente</h2>
          <p>O mesmo mapeamento e identidade serão reaplicados. Schema drift pausa a atualização antes de alterar eventos salvos.</p>
          <label>
            Novo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                setFile(null);
                setError("");
                if (selected && (!selected.name.toLowerCase().endsWith(".csv") || !selected.size || selected.size > 4 * 1024 * 1024)) {
                  setError("Selecione um CSV entre 1 byte e 4 MB.");
                  return;
                }
                setFile(selected ?? null);
              }}
            />
          </label>
          <div className="actions">
            <button className="button secondary" disabled={busy} onClick={() => setUploadTo(null)}>Cancelar</button>
            <button className="button" disabled={!file || busy} onClick={resync}>{busy ? "Sincronizando…" : "Sincronizar CSV"}</button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="error-banner">{error}</p>}
      {result && (
        <SyncResult
          result={result}
          explorerHref={`/processes/${processId}/explorer`}
          onRetryAnalysis={canManage && !busy ? () => retry(result.run.id) : undefined}
        />
      )}

      <section className="pt-dashboard-panel" id="sync-history">
        <div className="pt-section-title">
          <div>
            <span className="eyebrow">Histórico de execução</span>
            <h2>Histórico de sincronizações</h2>
          </div>
          <p>Últimas 50 execuções</p>
        </div>
        {historyFor && (
          <button className="button secondary compact" onClick={() => setHistoryFor(null)}>Mostrar todos</button>
        )}
        <div className="sync-table">
          <table>
            <thead>
              <tr>
                {["Data","Origem","Duração","Status","Arquivo","Recebidos","Novos","Atualizados","Duplicados","Inválidos","Análise"].map((label) => <th key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {history.map((run) => (
                <tr key={run.id}>
                  <td>{run.started_at ? formatDateTime(run.started_at) : "—"}</td>
                  <td>{run.trigger === "scheduled" ? "Agendada" : run.trigger === "retry" ? "Recuperação" : "Manual"}</td>
                  <td>{run.started_at && run.completed_at ? `${Math.max(0, Math.round((Date.parse(run.completed_at) - Date.parse(run.started_at)) / 1000))}s` : "—"}</td>
                  <td><span className="pt-table-status"><i className={`pt-status-dot ${run.status}`} />{syncStateLabel(run.status)}</span>{run.error_message && <small>{run.error_message}</small>}</td>
                  <td>{run.filename ?? "—"}</td>
                  <td>{run.fetched_count}</td>
                  <td>{run.accepted_count}</td>
                  <td>{run.updated_count}</td>
                  <td>{run.duplicate_count}</td>
                  <td>{run.invalid_count}</td>
                  <td>
                    {analysisStateLabel(run.analysis_status)}
                    {canManage && ["failed", "pending"].includes(run.analysis_status) && (
                      <button disabled={busy} className="button secondary compact" onClick={() => retry(run.id)}>Reanalisar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!history.length && <p>Nenhuma sincronização registrada.</p>}
      </section>
    </div>
  );
}
