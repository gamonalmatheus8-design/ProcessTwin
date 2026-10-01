import "server-only";
import type { SyncWriter } from "@/features/sync/service";
import { runCoreCycle } from "@/core/process/cycle";
import type { ProcessEvent } from "@/core/process/types";
import {
  parseCanonicalMapping,
  parseIdentityConfig,
  prepareRecurringCsv,
  SyncValidationError,
} from "@/features/sync/recurring-csv";
import { syncMessage } from "@/features/sync/service";
import type { FrozenMapping, SyncRun } from "@/features/sync/types";
import { fetchSheet } from "./google";
import { unseal } from "./security";
import { parseSource, SheetsError } from "./source";
export async function sheetsRpc<T>(
  writer: SyncWriter,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await writer.client.rpc(name, {
    ...args,
    p_actor: writer.actorId,
  });
  if (error) throw new Error("Sheets database operation failed");
  return data as T;
}
export type SheetConnector = {
  id: string;
  process_id: string;
  created_by: string;
  configuration: unknown;
  status: string;
  credential_ref: string | null;
};
export async function loadSheetConnector(
  writer: SyncWriter,
  processId: string,
  connectorId: string,
) {
  const { data, error } = await writer.client
    .from("connectors")
    .select("id,process_id,created_by,configuration,status,credential_ref")
    .eq("id", connectorId)
    .eq("process_id", processId)
    .eq("created_by", writer.actorId)
    .eq("type", "google_sheets")
    .maybeSingle();
  if (error || !data) throw new Error("Sheets connector unavailable");
  // Authorize again in the database before any Google data access.
  const credential = await sheetsRpc<{ id: string; ciphertext: string } | null>(
    writer,
    "sheets_credential_server",
    { p_process: processId },
  );
  if (!credential || credential.id !== data.credential_ref)
    throw new SheetsError("needs_reauth");
  return {
    connector: data as SheetConnector,
    token: unseal(
      credential.ciphertext,
      `credential:${processId}:${writer.actorId}`,
    ),
  };
}
export async function sheetPreview(
  writer: SyncWriter,
  processId: string,
  source: unknown,
) {
  const credential = await sheetsRpc<{ ciphertext: string } | null>(
    writer,
    "sheets_credential_server",
    { p_process: processId },
  );
  if (!credential) throw new SheetsError("needs_reauth");
  return fetchSheet(
    parseSource(source),
    unseal(credential.ciphertext, `credential:${processId}:${writer.actorId}`),
  );
}
export async function analyzeSheetRun(writer: SyncWriter, run: SyncRun) {
  if (!run.accepted_count && !run.updated_count) return run;
  try {
    const snapshot = await sheetsRpc<{
      revision: number;
      events: ProcessEvent[];
    } | null>(writer, "sheets_snapshot_server", { p_run: run.id });
    if (!snapshot) return run;
    return await sheetsRpc<SyncRun>(writer, "recurring_csv_analysis_server", {
      p_run: run.id,
      p_revision: snapshot.revision,
      p_result: runCoreCycle(snapshot.events),
    });
  } catch {
    return sheetsRpc<SyncRun>(writer, "recurring_csv_analysis_server", {
      p_run: run.id,
      p_revision: 0,
      p_result: null,
    });
  }
}
export async function synchronizeSheet(
  writer: SyncWriter,
  processId: string,
  connectorId: string,
  trigger: "manual" | "scheduled" = "manual",
) {
  // Start first: even fetch/refresh failures get a durable run and recovery state.
  let run = await sheetsRpc<
    SyncRun & { organization_id: string; process_id: string }
  >(writer, "sheets_start_server", {
    p_connector: connectorId,
    p_trigger: trigger,
    p_filename: "google-sheets.csv",
  });
  let fetched = 0,
    invalid = 0;
  try {
    const { connector, token } = await loadSheetConnector(
      writer,
      processId,
      connectorId,
    );
    const { data: saved, error } = await writer.client
      .from("connector_mappings")
      .select("canonical_mapping,identity_config,source_schema_hash")
      .eq("connector_id", connectorId)
      .eq("active", true)
      .single();
    if (error || !saved)
      throw new SyncValidationError(
        "invalid_mapping",
        "Mapeamento indisponível.",
      );
    const mapping: FrozenMapping = {
      canonical_mapping: parseCanonicalMapping(saved.canonical_mapping),
      identity_config: parseIdentityConfig(saved.identity_config),
      source_schema_hash: saved.source_schema_hash,
    };
    const contents = await fetchSheet(
      parseSource(connector.configuration),
      token,
    );
    const batch = prepareRecurringCsv(
      contents,
      mapping.canonical_mapping,
      mapping.identity_config,
    );
    fetched = batch.fetched;
    invalid = batch.invalid;
    const storagePath = `${run.organization_id}/${run.process_id}/${run.dataset_id}/sync/${run.id}/google-sheets.csv`;
    const { error: archiveError } = await writer.client.storage
      .from("process-datasets")
      .upload(storagePath, new Blob([contents], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: false,
      });
    if (archiveError) throw new Error("storage_failed");
    run = await sheetsRpc<typeof run>(writer, "recurring_csv_merge_server", {
      p_run: run.id,
      p_events: batch.records,
      p_fetched: fetched,
      p_invalid: invalid,
      p_schema_hash: batch.schemaHash,
      p_storage_path: storagePath,
    });
  } catch (error) {
    const code =
      error instanceof SyncValidationError || error instanceof SheetsError
        ? error.code
        : "sync_failed";
    run = await sheetsRpc<typeof run>(writer, "sheets_fail_server", {
      p_run: run.id,
      p_code: code,
      p_fetched: error instanceof SyncValidationError ? error.fetched : fetched,
      p_invalid: error instanceof SyncValidationError ? error.invalid : invalid,
    });
  }
  const final = await analyzeSheetRun(writer, run);
  return {
    connectorId,
    datasetId: final.dataset_id,
    run: final,
    message: syncMessage(final),
    analysisExecuted: final.analysis_status === "succeeded",
  };
}
