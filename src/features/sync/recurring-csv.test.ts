import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSourcePayloadHash } from "./idempotency";
import { demoSyncIdentity, demoSyncMapping, ordersSync01, ordersSync02 } from "./demo-data";
import { mergeDemoEvents } from "./demo-merge";
import { parseCanonicalMapping, parseIdentityConfig, prepareRecurringCsv, sourceSchemaHash } from "./recurring-csv";

const batch1 = () => prepareRecurringCsv(ordersSync01, demoSyncMapping, demoSyncIdentity);
const batch2 = () => prepareRecurringCsv(ordersSync02, demoSyncMapping, demoSyncIdentity);
describe("recurring CSV preparation and demonstrator", () => {
  it("same CSV twice: no new analysis, all records duplicate", () => {
    const first = mergeDemoEvents([], batch1().records);
    const second = mergeDemoEvents(first.events, batch1().records);
    expect(second).toMatchObject({ accepted: 0, updated: 0, duplicate: 100, analysis: null });
    expect(second.events).toHaveLength(100);
  });
  it("100/123 fixture ends with 120 events and analyzes the entire live dataset", () => {
    const first = mergeDemoEvents([], batch1().records);
    const second = mergeDemoEvents(first.events, batch2().records);
    expect(second).toMatchObject({ accepted: 20, updated: 3, duplicate: 100 });
    expect(second.events).toHaveLength(120);
    expect(second.analysis?.metrics.eventCount).toBe(120);
    const retry = mergeDemoEvents(second.events, batch2().records);
    expect(retry).toMatchObject({ accepted: 0, updated: 0, duplicate: 123, analysis: null });
  });
  it("corrections preserve the identity and event index", () => {
    const first = mergeDemoEvents([], batch1().records);
    const second = mergeDemoEvents(first.events, batch2().records);
    const original = first.events[0];
    const corrected = second.events.find((event) => event.sourceEventKey === original.sourceEventKey)!;
    expect(corrected.eventIndex).toBe(original.eventIndex);
    expect(corrected.resource).toBe("Equipe B");
    expect(corrected.sourcePayloadHash).not.toBe(original.sourcePayloadHash);
  });
  it("reordering does not change keys or cause duplicates", () => {
    const lines = ordersSync01.trim().split("\n");
    const reversed = prepareRecurringCsv([lines[0], ...lines.slice(1).reverse()].join("\n"), demoSyncMapping, demoSyncIdentity);
    const first = mergeDemoEvents([], batch1().records);
    expect(mergeDemoEvents(first.events, reversed.records)).toMatchObject({ accepted: 0, updated: 0, duplicate: 100 });
  });
  it("source_fields ordering does not change identity", () => {
    const a = prepareRecurringCsv(ordersSync01, demoSyncMapping, { strategy: "source_fields", fields: ["pedido_id", "etapa"], version: "v1" });
    const b = prepareRecurringCsv(ordersSync01, demoSyncMapping, { strategy: "source_fields", fields: ["etapa", "pedido_id"], version: "v1" });
    expect(a.records).toEqual(b.records);
  });
  it("canonical fingerprint uses the existing identity contract", () => {
    const batch = prepareRecurringCsv(ordersSync01, demoSyncMapping, { strategy: "canonical_fingerprint", fields: [], version: "v1" });
    expect(batch.records[0].sourceEventKey).toMatch(/^canonical:v1:/);
    expect(batch.records[0].sourcePayloadHash).toBe(buildSourcePayloadHash(batch.records[0]));
  });
  it.each(["pedido_id", "etapa", "data_evento", "responsavel", "event_id"])("missing configured column %s blocks ingestion", (column) => {
    expect(() => prepareRecurringCsv(ordersSync01.replace(column, `${column}_changed`), demoSyncMapping, demoSyncIdentity)).toThrow("O arquivo mudou e o mapeamento precisa ser revisado.");
  });
  it("additive drift leaves payload hashes stable", () => {
    const lines = ordersSync01.trim().split("\n").map((line, index) => `${line},${index ? "new value" : "extra"}`);
    const additive = prepareRecurringCsv(lines.join("\n"), demoSyncMapping, demoSyncIdentity);
    expect(additive.records).toEqual(batch1().records);
    expect(additive.schemaHash).not.toBe(batch1().schemaHash);
  });
  it("schema hash is deterministic across header order and normalization", () => {
    expect(sourceSchemaHash(["Número Pedido", " EVENT-ID "])).toBe(sourceSchemaHash(["event_id", "numero_pedido"]));
  });
  it("partial input retains valid source-row association", () => {
    const csv = ordersSync01.replace("E2,P1,Aprovado", "E2,,Aprovado");
    const batch = prepareRecurringCsv(csv, demoSyncMapping, demoSyncIdentity);
    expect(batch).toMatchObject({ fetched: 100, invalid: 1 });
    expect(batch.records[1].sourceEventKey).toBe(batch1().records[2].sourceEventKey);
  });
  it("empty identity values are invalid records", () => {
    const batch = prepareRecurringCsv(ordersSync01.replace("E1,P1", ",P1"), demoSyncMapping, demoSyncIdentity);
    expect(batch.invalid).toBe(1);
  });
  it("excessive invalid data fails the entire batch", () => {
    expect(() => prepareRecurringCsv(ordersSync01.replaceAll("T08:00:00Z", "invalid"), demoSyncMapping, demoSyncIdentity)).toThrow("inválidos demais");
  });
  it("conflicting versions in one export fail before any merge", () => {
    expect(() => prepareRecurringCsv(ordersSync01 + "E1,P1,Recebido,2026-09-01T08:00:00Z,Equipe B\n", demoSyncMapping, demoSyncIdentity)).toThrow("versões conflitantes");
  });
  it("ambiguous normalized headers fail", () => {
    expect(() => prepareRecurringCsv(ordersSync01.replace("event_id,", "event_id,Event-ID,"), demoSyncMapping, demoSyncIdentity)).toThrow("ambíguas");
  });
  it("rejects invalid config and untyped mappings", () => {
    expect(() => parseIdentityConfig({ strategy: "source_id", fields: [], version: "v1" })).toThrow();
    expect(() => parseIdentityConfig({ strategy: "source_fields", fields: ["id", "id"], version: "v1" })).toThrow();
    expect(() => parseIdentityConfig({ strategy: "row_number", fields: [], version: "v1" })).toThrow();
    expect(() => parseCanonicalMapping({ caseId: {} })).toThrow();
  });
  it("checked-in and downloadable CSVs match demo data", () => {
    for (const [name, data] of [["orders-sync-01.csv", ordersSync01], ["orders-sync-02.csv", ordersSync02]]) {
      expect(readFileSync(`examples/sync/${name}`, "utf8").trim()).toBe(data.trim());
      expect(readFileSync(`public/examples/sync/${name}`, "utf8").trim()).toBe(data.trim());
    }
  });
});
