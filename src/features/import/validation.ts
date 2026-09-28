import type { ProcessEvent } from "@/core/process/types";
import { validateMapping } from "./mapping";
import type { ColumnMapping, ImportValidation, ParsedCsv, RowValidationError } from "./types";

const LOCAL_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const normalizedUtc = (parts: RegExpExecArray, hours = "00", minutes = "00", seconds = "00") => {
  const [, y, m, d] = parts;
  const date = new Date(Date.UTC(+y, +m - 1, +d, +hours, +minutes, +seconds));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d || date.getUTCHours() !== +hours || date.getUTCMinutes() !== +minutes || date.getUTCSeconds() !== +seconds) return null;
  return date.toISOString();
};

export function normalizeTimestamp(value: string): string | null {
  const trimmed = value.trim();
  const local = LOCAL_TIMESTAMP.exec(trimmed);
  if (local) {
    return normalizedUtc(local, local[4], local[5], local[6] ?? "00");
  }
  const dateOnly = DATE_ONLY.exec(trimmed);
  if (dateOnly) return normalizedUtc(dateOnly);
  const milliseconds = Date.parse(trimmed);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

export function validateAndNormalizeCsv(parsed: ParsedCsv, mapping: ColumnMapping): ImportValidation {
  const errors: RowValidationError[] = parsed.errors.map((error) => ({ rowNumber: error.row ?? 1, field: "csv", message: error.message }));
  const mappingErrors = validateMapping(mapping, parsed.headers);
  errors.push(...mappingErrors.map((message) => ({ rowNumber: 1, field: "csv" as const, message })));
  const events: ProcessEvent[] = [];
  const malformedRows = new Set(parsed.errors.flatMap((error) => error.row ? [error.row] : []));

  if (!mappingErrors.length) {
    for (const row of parsed.rows) {
      if (malformedRows.has(row.rowNumber)) continue;
      const caseId = row.values[mapping.caseId!]!.trim();
      const activity = row.values[mapping.activity!]!.trim();
      const rawTimestamp = row.values[mapping.timestamp!]!.trim();
      const timestamp = normalizeTimestamp(rawTimestamp);
      const rowErrors: RowValidationError[] = [];
      if (!caseId) rowErrors.push({ rowNumber: row.rowNumber, field: "caseId", message: "Case ID vazio." });
      if (!activity) rowErrors.push({ rowNumber: row.rowNumber, field: "activity", message: "Atividade vazia." });
      if (!timestamp) rowErrors.push({ rowNumber: row.rowNumber, field: "timestamp", message: "Timestamp inválido.", value: rawTimestamp });
      errors.push(...rowErrors);
      if (!rowErrors.length) {
        const resource = mapping.resource ? row.values[mapping.resource]?.trim() : undefined;
        events.push({ caseId, activity, timestamp: timestamp!, resource: resource || null });
      }
    }
  }

  const timestamps = events.map((event) => event.timestamp).sort();
  const invalidRows = new Set(errors.filter((error) => error.rowNumber > 1).map((error) => error.rowNumber)).size;
  return {
    events,
    errors,
    preview: events.slice(0, 10),
    summary: {
      totalRows: parsed.rows.length,
      validRows: events.length,
      invalidRows,
      caseCount: new Set(events.map((event) => event.caseId)).size,
      activityCount: new Set(events.map((event) => event.activity)).size,
      periodStart: timestamps[0] ?? null,
      periodEnd: timestamps.at(-1) ?? null,
    },
  };
}
