import { createHash } from "node:crypto";
import { normalizeHeader, validateMapping } from "@/features/import/mapping";
import { parseCsv } from "@/features/import/parser";
import type { ColumnMapping } from "@/features/import/types";
import { validateAndNormalizeCsv } from "@/features/import/validation";
import { buildEventIdempotency } from "./idempotency";
import type { IdentityConfig, SyncRecord } from "./types";

export const SCHEMA_DRIFT_MESSAGE = "O arquivo mudou e o mapeamento precisa ser revisado.";
export const MAX_SYNC_ROWS = 20_000;
export class SyncValidationError extends Error {
  constructor(public code: "schema_drift" | "invalid_mapping" | "invalid_csv" | "data_quality", message: string, public fetched = 0, public invalid = 0) { super(message); }
}
export function sourceSchemaHash(headers: readonly string[]) {
  return createHash("sha256").update(JSON.stringify(headers.map(normalizeHeader).sort())).digest("hex");
}
export function parseIdentityConfig(value: unknown): IdentityConfig {
  if (!value || typeof value !== "object") throw new SyncValidationError("invalid_mapping", "Configure a identidade do evento.");
  const config = value as Record<string, unknown>;
  const strategy = config.strategy;
  if (!["source_id", "source_fields", "canonical_fingerprint"].includes(String(strategy)) || config.version !== "v1") throw new SyncValidationError("invalid_mapping", "Identidade do evento inválida.");
  const fields = Array.isArray(config.fields) ? config.fields.filter((field): field is string => typeof field === "string" && Boolean(field.trim())) : [];
  if (strategy === "source_id" && fields.length !== 1 || strategy === "source_fields" && !fields.length || strategy === "canonical_fingerprint" && fields.length) throw new SyncValidationError("invalid_mapping", "Selecione os campos de identidade.");
  if (new Set(fields).size !== fields.length) throw new SyncValidationError("invalid_mapping", "Campos de identidade repetidos.");
  return { strategy: strategy as IdentityConfig["strategy"], fields: fields.sort(), version: "v1" };
}
export function parseCanonicalMapping(value: unknown): ColumnMapping {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyncValidationError("invalid_mapping", "Mapeamento inválido.");
  const result: ColumnMapping = {};
  for (const field of ["caseId", "activity", "timestamp", "resource"] as const) {
    const column = (value as Record<string, unknown>)[field];
    if (column !== undefined && column !== null && column !== "") {
      if (typeof column !== "string") throw new SyncValidationError("invalid_mapping", "Mapeamento inválido.");
      result[field] = column;
    }
  }
  return result;
}
export function prepareRecurringCsv(contents: string, mapping: ColumnMapping, identity: IdentityConfig, frozen = true) {
  const parsed = parseCsv(contents);
  const fetched = parsed.rows.length;
  if (fetched > MAX_SYNC_ROWS || parsed.headers.length > 64) throw new SyncValidationError("invalid_csv", "Envie até 20.000 registros e 64 colunas por sincronização.", fetched);
  // Normalized collisions are ambiguous even when PapaParse renames an exact duplicate.
  const normalized = parsed.headers.map(normalizeHeader);
  if (!parsed.headers.length || parsed.duplicateHeaders || normalized.some((header) => !header) || new Set(normalized).size !== normalized.length) throw new SyncValidationError("invalid_csv", "O CSV possui colunas vazias ou ambíguas.", fetched);
  const used = [...Object.values(mapping), ...identity.fields].filter((column): column is string => Boolean(column));
  if (used.some((column) => !parsed.headers.includes(column))) throw new SyncValidationError("schema_drift", SCHEMA_DRIFT_MESSAGE, fetched);
  if (validateMapping(mapping, parsed.headers).length) throw new SyncValidationError("invalid_mapping", "Revise o mapeamento das colunas obrigatórias.", fetched);
  if (!fetched || parsed.errors.some((error) => !error.row)) throw new SyncValidationError("invalid_csv", "O arquivo não contém uma estrutura CSV válida.", fetched);
  const records: SyncRecord[] = [];
  // Validate each row using the existing intake validator to preserve the source-row association.
  for (const row of parsed.rows) {
    const errors = parsed.errors.filter((error) => error.row === row.rowNumber);
    const event = validateAndNormalizeCsv({ ...parsed, rows: [row], errors }, mapping).events[0];
    if (!event) continue;
    try {
      const key = identity.strategy === "source_id" ? { strategy: "source_id" as const, sourceId: row.values[identity.fields[0]] ?? "" }
        : identity.strategy === "source_fields" ? { strategy: "source_fields" as const, fields: identity.fields, record: row.values }
        : { strategy: "canonical_fingerprint" as const, event };
      records.push({ ...event, ...buildEventIdempotency(key, event) });
    } catch { /* Identity errors count as invalid rows; never include row contents in diagnostics. */ }
  }
  const invalid = fetched - records.length;
  const payloads = new Map<string, string>();
  for (const record of records) {
    if (payloads.has(record.sourceEventKey) && payloads.get(record.sourceEventKey) !== record.sourcePayloadHash) throw new SyncValidationError("data_quality", "O arquivo contém versões conflitantes do mesmo evento.", fetched, invalid);
    payloads.set(record.sourceEventKey, record.sourcePayloadHash);
  }
  if (!records.length || invalid / fetched > 0.2) throw new SyncValidationError("data_quality", "O arquivo possui registros inválidos demais. Revise os dados e tente novamente.", fetched, invalid);
  return { parsed, records, fetched, invalid, schemaHash: sourceSchemaHash(parsed.headers), frozen };
}
