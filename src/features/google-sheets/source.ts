import Papa from "papaparse";
export type SheetSource = { spreadsheetId: string; sheetName: string };
export class SheetsError extends Error {
  constructor(
    public code:
      | "needs_reauth"
      | "source_unavailable"
      | "source_temporary"
      | "invalid_csv",
  ) {
    super(code);
  }
}
export function parseSource(value: unknown): SheetSource {
  if (!value || typeof value !== "object") throw new SheetsError("invalid_csv");
  const { spreadsheetId, sheetName } = value as Record<string, unknown>;
  if (
    typeof spreadsheetId !== "string" ||
    !/^[a-zA-Z0-9_-]{20,200}$/.test(spreadsheetId) ||
    typeof sheetName !== "string" ||
    !sheetName.trim() ||
    sheetName.length > 100 ||
    /[\[\]*?/\\\x00-\x1f]/.test(sheetName)
  )
    throw new SheetsError("invalid_csv");
  return { spreadsheetId, sheetName };
}
export function sheetRange(source: SheetSource) {
  // Fetch one extra row and column to detect truncation instead of silently accepting it.
  return `'${source.sheetName.replaceAll("'", "''")}'!A1:BM20002`;
}
export function valuesToCsv(values: unknown) {
  if (
    !Array.isArray(values) ||
    values.length < 2 ||
    values.length > 20001 ||
    values.some(
      (row) =>
        !Array.isArray(row) ||
        row.length > 64 ||
        row.some(
          (cell) => !["string", "number", "boolean"].includes(typeof cell),
        ),
    )
  )
    throw new SheetsError("invalid_csv");
  const rows = values as (string | number | boolean)[][];
  const headers = rows[0].map(String);
  if (rows.slice(1).some((row) => row.length > headers.length))
    throw new SheetsError("invalid_csv");
  const csv = Papa.unparse(
    rows.map((row) => headers.map((_, index) => String(row[index] ?? ""))),
  );
  if (new TextEncoder().encode(csv).length > 4 * 1024 * 1024)
    throw new SheetsError("invalid_csv");
  return csv;
}
export async function boundedJson(response: Response) {
  if (!response.body) throw new SheetsError("source_temporary");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024) throw new SheetsError("invalid_csv");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, position);
      position += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as { values?: unknown };
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof SheetsError) throw error;
    throw new SheetsError("source_temporary");
  } finally {
    reader.releaseLock();
  }
}
