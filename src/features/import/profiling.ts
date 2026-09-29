import { normalizeTimestamp } from "./validation";
import type { ColumnProfile, ParsedCsv } from "./types";

export const PROFILE_SAMPLE_LIMIT = 500;
const PROFILE_VALUE_LIMIT = 5;
const NUMBER = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
const TEMPORAL_SHAPE = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})(?:[T\s].*)?$/;

export function profileColumns(parsed: ParsedCsv, limit = PROFILE_SAMPLE_LIMIT): ColumnProfile[] {
  const rows = parsed.rows.slice(0, Math.max(0, Math.min(limit, PROFILE_SAMPLE_LIMIT)));
  return parsed.headers.map((column) => {
    const values = rows.map((row) => row.values[column]?.trim() ?? "");
    const filled = values.filter(Boolean);
    const unique = [...new Set(filled)];
    const denominator = filled.length || 1;
    return {
      column,
      sampledRows: rows.length,
      filledCount: filled.length,
      emptyCount: values.length - filled.length,
      uniqueCount: unique.length,
      uniquenessRatio: unique.length / denominator,
      repetitionRatio: 1 - unique.length / denominator,
      timestampParseRatio: filled.filter((value) => TEMPORAL_SHAPE.test(value) && normalizeTimestamp(value) !== null).length / denominator,
      numericRatio: filled.filter((value) => NUMBER.test(value)).length / denominator,
      sampleValues: unique.slice(0, PROFILE_VALUE_LIMIT),
    };
  });
}
