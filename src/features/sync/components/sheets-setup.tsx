"use client";
import { useEffect, useMemo, useState } from "react";
import { suggestColumnMappingV2 } from "@/features/import/auto-mapping";
import { AutoMappingPanel } from "@/features/import/components/auto-mapping-panel";
import { parseCsv } from "@/features/import/parser";
import { profileColumns } from "@/features/import/profiling";
import { validateMapping } from "@/features/import/mapping";
import {
  getProcessPack,
  PROCESS_PACKS,
  type ProcessPackId,
} from "@/features/import/process-packs";
import type { ColumnMapping, ParsedCsv } from "@/features/import/types";
import type { IdentityConfig, SyncResponse } from "../types";
import { canonicalFieldLabel } from "../presentation";
type Preview = {
  sampleCsv: string;
  total: number;
  schemaHash: string;
  savedMapping: {
    canonical_mapping: ColumnMapping;
    identity_config: IdentityConfig;
  } | null;
};
export function SheetsSetup({
  processId,
  connectorId,
  available,
  notice,
  onResult,
  onClose,
}: {
  processId: string;
  connectorId?: string;
  available: boolean;
  notice?: string;
  onResult: (result: SyncResponse) => void;
  onClose: () => void;
}) {
  const [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState("Planilha operacional"),
    [spreadsheet, setSpreadsheet] = useState(""),
    [sheetName, setSheetName] = useState("Página1");
  const [pack, setPack] = useState<ProcessPackId>("generic"),
    [daily, setDaily] = useState(false),
    [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null),
    [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({}),
    [idColumn, setIdColumn] = useState("");
  const suggestion = useMemo(
    () =>
      parsed
        ? suggestColumnMappingV2({
            headers: parsed.headers,
            profiles: profileColumns(parsed),
            processPack: getProcessPack(pack)!,
          })
        : null,
    [parsed, pack],
  );
  const valid =
    parsed &&
    !validateMapping(mapping, parsed.headers).length &&
    Boolean(idColumn);
  const sourceId =
    spreadsheet.match(
      /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    )?.[1] ?? spreadsheet.trim();
  async function api(body: Record<string, unknown>) {
    const response = await fetch(`/api/processes/${processId}/sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(value.error ?? "Não foi possível concluir esta etapa.");
    return value;
  }
  useEffect(() => {
    if (!available) return;
    let current = true;
    api({ action: "status" })
      .then((value) => {
        if (current) setConnected(value.connected);
      })
      .catch(() => {
        if (current) setError("Não foi possível verificar a conexão Google.");
      });
    return () => {
      current = false;
    };
    // The request is bound to this process; the API derives the actor from the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId, available]);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function read() {
    const value: Preview = await api({
      action: "preview",
      connectorId,
      source: { spreadsheetId: sourceId, sheetName },
    });
    const sample = parseCsv(value.sampleCsv);
    setPreview(value);
    setParsed(sample);
    setMapping(
      value.savedMapping?.canonical_mapping ??
        suggestColumnMappingV2({
          headers: sample.headers,
          profiles: profileColumns(sample),
          processPack: getProcessPack(pack)!,
        }).mapping,
    );
    setIdColumn(
      value.savedMapping?.identity_config.fields[0] ??
        (sample.headers.includes("event_id") ? "event_id" : ""),
    );
    setStep(1);
  }
  async function confirm() {
    const result: SyncResponse = await api({
      action: connectorId ? "review" : "create",
      connectorId,
      confirmed: true,
      schemaHash: preview?.schemaHash,
      source: { spreadsheetId: sourceId, sheetName },
      name,
      processPackId: pack,
      schedule: daily ? 1440 : null,
      mapping,
      identity: { strategy: "source_id", fields: [idColumn], version: "v1" },
    });
    onResult(result);
    onClose();
  }
  return (
    <section
      className="panel wizard"
      aria-busy={busy}
      aria-label="Configuração Google Sheets"
    >
      <span className="eyebrow">
        {connectorId ? "Revisão da fonte" : "Nova fonte"}
      </span>
      <h2>
        {connectorId
          ? "Revisar e retomar Google Sheets"
          : "Conectar Google Sheets"}
      </h2>
      {!available ? (
        <p role="status">
          A conexão Google precisa ser configurada pelo administrador antes de
          ser utilizada.
        </p>
      ) : (
        <>
          {notice === "connected" && (
            <p role="status">
              Conta Google conectada. Agora escolha a planilha e confirme o
              mapeamento.
            </p>
          )}
          {notice === "failed" && (
            <p role="alert" className="error-banner">
              A autorização não foi concluída. Conecte novamente.
            </p>
          )}
          <p>
            Acesso de leitura. O ProcessTwin não altera a planilha. Sua conta
            precisa ter acesso ao arquivo.
          </p>
          <div className="actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const value = await api({ action: "authorize" });
                  window.location.assign(value.url);
                })
              }
            >
              {connected ? "Reconectar conta Google" : "Conectar conta Google"}
            </button>
            {connected && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api({ action: "disconnect" });
                    setConnected(false);
                    setStep(0);
                  })
                }
              >
                Desconectar desta operação
              </button>
            )}
          </div>
          {connected && step === 0 && (
            <>
              {!connectorId && (
                <div className="two-columns">
                  <label>
                    Nome da conexão
                    <input
                      value={name}
                      maxLength={160}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Contexto
                    <select
                      value={pack}
                      onChange={(e) => setPack(e.target.value as ProcessPackId)}
                    >
                      {PROCESS_PACKS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Link ou ID da planilha
                    <input
                      value={spreadsheet}
                      onChange={(e) => setSpreadsheet(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/…"
                    />
                  </label>
                  <label>
                    Nome exato da aba
                    <input
                      value={sheetName}
                      maxLength={100}
                      onChange={(e) => setSheetName(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <p>
                Use cabeçalhos na primeira linha e datas em texto ISO 8601. Até
                20.000 eventos e 64 colunas. Uma coluna com ID estável é
                obrigatória.
              </p>
              {!connectorId && (
                <label className="sheets-check">
                  <input
                    type="checkbox"
                    checked={daily}
                    onChange={(e) => setDaily(e.target.checked)}
                  />
                  Sincronizar diariamente, às 00h de Brasília
                </label>
              )}
              {!connectorId && (
                <p className="fair-small">
                  O piloto admite até três conexões com agendamento diário. Você
                  também pode sincronizar manualmente.
                </p>
              )}
              <button
                className="button"
                disabled={
                  busy ||
                  (!connectorId &&
                    (!sourceId || !sheetName || name.trim().length < 2))
                }
                onClick={() => void act(read)}
              >
                Carregar amostra para revisão
              </button>
            </>
          )}
          {connected && step === 1 && parsed && suggestion && (
            <>
              <h3>Confirme o mapeamento</h3>
              <p>
                Amostra de até 50 eventos, de {preview?.total} registros. A
                validação completa será executada antes da sincronização.
              </p>
              <AutoMappingPanel
                headers={parsed.headers}
                mapping={mapping}
                analysis={suggestion}
                onChange={setMapping}
              />
              <label>
                ID estável do evento
                <select
                  value={idColumn}
                  disabled={Boolean(connectorId)}
                  onChange={(e) => setIdColumn(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {parsed.headers.map((header) => (
                    <option key={header}>{header}</option>
                  ))}
                </select>
              </label>
              {connectorId && (
                <p>
                  A identidade original será preservada. Se a coluna de ID
                  desapareceu, restaure-a na planilha antes de retomar.
                </p>
              )}
              <div className="table-wrap">
                <table>
                  <caption>Amostra da planilha autorizada</caption>
                  <thead>
                    <tr>
                      {parsed.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row) => (
                      <tr key={row.rowNumber}>
                        {parsed.headers.map((header) => (
                          <td key={header}>{row.values[header]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setStep(0)}
                >
                  Voltar
                </button>
                <button
                  className="button"
                  disabled={busy || !valid}
                  onClick={() => setStep(2)}
                >
                  Revisar confirmação
                </button>
              </div>
            </>
          )}
          {connected && step === 2 && (
            <>
              <h3>Confirmação da fonte</h3>
              <dl className="sync-review">
                <dt>Conexão</dt>
                <dd>{connectorId ? "Revisão do conector existente" : name}</dd>
                <dt>Colunas</dt>
                <dd>
                  {Object.entries(mapping)
                    .map(
                      ([field, column]) =>
                        `${canonicalFieldLabel[field]} → ${column}`,
                    )
                    .join(" · ")}
                </dd>
                <dt>Identidade</dt>
                <dd>{idColumn} · preservada em novas sincronizações</dd>
                <dt>Frequência</dt>
                <dd>
                  {connectorId
                    ? "Frequência original preservada"
                    : daily
                      ? "Diariamente, às 00h de Brasília"
                      : "Manual"}
                </dd>
              </dl>
              <p>
                Alterações incompatíveis pausarão o conector para revisão. A
                planilha será lida novamente antes de gravar os eventos.
              </p>
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void act(confirm)}
                >
                  {busy ? "Sincronizando…" : "Confirmar e sincronizar"}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <button className="button secondary" disabled={busy} onClick={onClose}>
        Fechar configuração
      </button>
    </section>
  );
}
