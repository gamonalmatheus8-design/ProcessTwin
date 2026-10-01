import { describe, expect, it } from "vitest";
import { boundedJson, parseSource, sheetRange, valuesToCsv } from "./source";
import { prepareRecurringCsv } from "@/features/sync/recurring-csv";
const source = { spreadsheetId: "a".repeat(30), sheetName: "Aluno's" };
describe("Google Sheets source limits and canonical compatibility", () => {
  it("accepts IDs only, escapes sheet titles and bounds the requested grid", () => {
    expect(sheetRange(parseSource(source))).toBe("'Aluno''s'!A1:BM20002");
    expect(() =>
      parseSource({ ...source, spreadsheetId: "https://evil.example/" }),
    ).toThrow();
    expect(() => parseSource({ ...source, sheetName: "Tab!A1" })).not.toThrow();
    expect(() => parseSource({ ...source, sheetName: "Tab[1]" })).toThrow();
  });
  it("exports formatted values into the same canonical and idempotency pipeline", () => {
    const csv = valuesToCsv([
      ["event_id", "case", "activity", "time"],
      ["001", "student,1", "Conferência", "2026-09-01T10:00:00Z"],
      ["002", "student,1", "Confirmada", "2026-09-01T12:00:00Z"],
    ]);
    const batch = prepareRecurringCsv(
      csv,
      { caseId: "case", activity: "activity", timestamp: "time" },
      { strategy: "source_id", fields: ["event_id"], version: "v1" },
    );
    expect(batch.fetched).toBe(2);
    expect(batch.records[0].caseId).toBe("student,1");
    expect(batch.records[0].sourceEventKey).toMatch(/^source-id:v1:/);
  });
  it.each(
    [
      [],
      [["id"]],
      [["id"], ["1", "extra"]],
      [Array.from({ length: 65 }, () => "col"), ["1"]],
      [["id"], [null]],
      Array.from({ length: 20002 }, () => ["id"]),
    ].map((value) => ({ value })),
  )("rejects unbounded, truncated or malformed grids", ({ value }) => {
    expect(() => valuesToCsv(value)).toThrow();
  });
  it("does not silently accept a removed mapped column", () => {
    const csv = valuesToCsv([
      ["id", "renamed", "activity", "time"],
      ["1", "x", "Opened", "2026-09-01T00:00:00Z"],
    ]);
    expect(() =>
      prepareRecurringCsv(
        csv,
        { caseId: "case", activity: "activity", timestamp: "time" },
        { strategy: "source_id", fields: ["id"], version: "v1" },
      ),
    ).toThrow("mapeamento");
  });
  it("limits response bytes before parsing JSON", async () => {
    await expect(
      boundedJson(new Response("x".repeat(4 * 1024 * 1024 + 1))),
    ).rejects.toThrow("invalid_csv");
    expect(
      await boundedJson(Response.json({ values: [["id"], ["1"]] })),
    ).toEqual({ values: [["id"], ["1"]] });
  });
});
