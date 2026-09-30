import type { ColumnMapping } from "@/features/import/types";
import type { CanonicalSyncEvent } from "./idempotency";

export type IdentityConfig = { strategy: "source_id" | "source_fields" | "canonical_fingerprint"; fields: string[]; version: "v1" };
export type SyncRecord = CanonicalSyncEvent & { sourceEventKey: string; sourcePayloadHash: string; sourceUpdatedAt?: string | null };
export type FrozenMapping = { canonical_mapping: ColumnMapping; identity_config: IdentityConfig; source_schema_hash: string };
export type SyncRun = {
  id: string; connector_id: string; dataset_id: string; status: string;
  started_at: string | null; completed_at: string | null; filename: string | null;
  fetched_count: number; accepted_count: number; updated_count: number; duplicate_count: number; invalid_count: number;
  analysis_status: "pending" | "skipped" | "succeeded" | "failed" | "superseded";
  analysis_run_id: string | null; error_message: string | null;
};
export type ConnectorCard = { id: string; name: string; type: string; status: string; dataset_id: string | null; datasetName: string; totalRuns: number; lastSync: string | null; lastSuccess: string | null };
export type SyncResponse = { connectorId: string; datasetId: string; run: SyncRun; message: string; analysisExecuted: boolean };
