import type { SupabaseClient } from "@supabase/supabase-js";
import { runCoreCycle } from "@/core/process/cycle";
import type { ProcessEvent } from "@/core/process/types";
import { prepareRecurringCsv, SyncValidationError } from "./recurring-csv";
import type { FrozenMapping, SyncResponse, SyncRun } from "./types";

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error("Não foi possível registrar esta etapa da sincronização.");
  return data as T;
}
// Supplied only by the authenticated route, never by form data.
export type SyncWriter = { client: SupabaseClient; actorId: string };
async function writeRpc<T>(writer: SyncWriter, name: string, args: Record<string, unknown>): Promise<T> {
  return rpc<T>(writer.client, `${name}_server`, { ...args, p_actor: writer.actorId });
}
export async function analyzeSyncRun(client: SupabaseClient, run: SyncRun, writer: SyncWriter): Promise<SyncRun> {
  if (run.accepted_count + run.updated_count === 0 || !["succeeded", "partial"].includes(run.status)) return run;
  try {
    const snapshot = await rpc<{ revision: number; events: ProcessEvent[]; run?: SyncRun } | null>(client, "recurring_csv_snapshot", { p_run: run.id });
    if (!snapshot) return run;
    if (snapshot.run) return snapshot.run;
    const result = runCoreCycle(snapshot.events);
    return await writeRpc<SyncRun>(writer, "recurring_csv_analysis", { p_run: run.id, p_revision: snapshot.revision, p_result: result });
  } catch {
    // Ingestion has already committed. This separate transaction never rolls it back.
    return await writeRpc<SyncRun>(writer, "recurring_csv_analysis", { p_run: run.id, p_revision: 0, p_result: null });
  }
}
export const syncMessage = (run: SyncRun) => run.status === "failed" ? run.error_message ?? "Sincronização interrompida."
  : run.accepted_count + run.updated_count === 0 ? "Nenhuma mudança detectada."
  : run.analysis_status === "failed" ? "Dados sincronizados. A análise falhou e pode ser executada novamente."
  : run.analysis_status === "superseded" ? "Dados sincronizados. Uma revisão mais recente foi analisada ou está pendente."
  : "Sincronização concluída.";

export async function synchronizeRecurringCsv({ client, connectorId, file, mapping, writer }: {
  client: SupabaseClient; connectorId: string; file: File; mapping: FrozenMapping; writer: SyncWriter;
}): Promise<SyncResponse> {
  const filename = `${file.name.replace(/\.csv$/i, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "export"}.csv`;
  let run = await rpc<SyncRun & { organization_id: string; process_id: string }>(client, "recurring_csv_start", { p_connector: connectorId, p_filename: filename });
  let fetched = 0, invalid = 0;
  try {
    const batch = prepareRecurringCsv(await file.text(), mapping.canonical_mapping, mapping.identity_config);
    fetched = batch.fetched; invalid = batch.invalid;
    const storagePath = `${run.organization_id}/${run.process_id}/${run.dataset_id}/sync/${run.id}/${filename}`;
    const { error } = await client.storage.from("process-datasets").upload(storagePath, file, { contentType: "text/csv", upsert: false });
    if (error) throw new Error("storage_failed");
    run = await writeRpc<typeof run>(writer, "recurring_csv_merge", {
      p_run: run.id, p_events: batch.records, p_fetched: fetched, p_invalid: invalid,
      p_schema_hash: batch.schemaHash, p_storage_path: storagePath,
    });
  } catch (error) {
    const code = error instanceof SyncValidationError ? error.code : error instanceof Error && error.message === "storage_failed" ? "storage_failed" : "sync_failed";
    run = await rpc<typeof run>(client, "recurring_csv_fail", { p_run: run.id, p_code: code,
      p_fetched: error instanceof SyncValidationError ? error.fetched : fetched,
      p_invalid: error instanceof SyncValidationError ? error.invalid : invalid });
    // A lost merge response may have committed successfully. fail() preserves that result.
  }
  const finalRun = await analyzeSyncRun(client, run, writer);
  return { connectorId, datasetId: finalRun.dataset_id, run: finalRun, message: syncMessage(finalRun), analysisExecuted: finalRun.analysis_status === "succeeded" };
}
