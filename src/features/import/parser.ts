import Papa from "papaparse";
import type { ParsedCsv } from "./types";

export function parseCsv(contents: string): ParsedCsv {
  if (!contents.trim()) return { headers: [], rows: [], delimiter: "", errors: [{ message: "O arquivo CSV está vazio." }] };

  const result = Papa.parse<Record<string, string>>(contents, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header, index) => index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = result.data.map((values, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? "")])),
  }));
  return {
    headers,
    rows,
    delimiter: result.meta.delimiter,
    errors: result.errors.map((error) => ({ row: error.row === undefined ? undefined : error.row + 2, message: error.message })),
  };
}
