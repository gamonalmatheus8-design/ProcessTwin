import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { analyzeSyncRun, synchronizeRecurringCsv } from "./service";
import { demoSyncIdentity, demoSyncMapping, ordersSync01 } from "./demo-data";
import type { SyncRun } from "./types";

const base = { id: "run-1", connector_id: "connector-1", organization_id: "org-1", process_id: "process-1", dataset_id: "live-1", status: "succeeded", accepted_count: 1, updated_count: 0, duplicate_count: 0, fetched_count: 1, invalid_count: 0, analysis_status: "pending" } as unknown as SyncRun;
function mockClient(handler: (name: string, args: Record<string, unknown>) => unknown, uploadError: unknown = null) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => handler(name, args));
  const upload = vi.fn(async () => ({ error: uploadError }));
  return { client: { rpc, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient, rpc, upload };
}
describe("sync orchestration and analysis consistency", () => {
  it("only the dedicated server writer receives canonical batches and Core results", async () => {
    const events = [{ caseId: "P1", activity: "A", timestamp: "2026-09-01T08:00:00Z" }];
    const session = mockClient(name => ({ error: null, data: name === "recurring_csv_snapshot" ? { revision: 1, events } : { ...base, status: "running" } }));
    const server = mockClient(name => ({ error: null, data: { ...base, analysis_status: name === "recurring_csv_analysis_server" ? "succeeded" : "pending" } }));
    await synchronizeRecurringCsv({ client: session.client, writer: { client: server.client, actorId: "verified-owner" }, connectorId: "connector-1", file: new File([ordersSync01], "orders.csv"), mapping: { canonical_mapping: demoSyncMapping, identity_config: demoSyncIdentity, source_schema_hash: "" } });
    expect(session.rpc.mock.calls.map(call => call[0])).toEqual(["recurring_csv_start", "recurring_csv_snapshot"]);
    expect(server.rpc.mock.calls.map(call => call[0])).toEqual(["recurring_csv_merge_server", "recurring_csv_analysis_server"]);
    for (const [, args] of server.rpc.mock.calls) expect(args.p_actor).toBe("verified-owner");
    expect(server.rpc.mock.calls[1][1].p_result).toMatchObject({ metrics: { eventCount: 1 } });
  });
  it("zero changes never calls snapshot or creates analysis", async () => {
    const { client, rpc } = mockClient(() => { throw new Error("unexpected"); });
    await analyzeSyncRun(client, { ...base, accepted_count: 0 }, { client, actorId: "verified-user" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("Core Cycle uses all canonical dataset events", async () => {
    const all = Array.from({ length: 120 }, (_, i) => ({ caseId: `P${Math.floor(i / 2)}`, activity: i % 2 ? "B" : "A", timestamp: `2026-09-01T${i % 2 ? "10" : "08"}:00:00Z` }));
    const { client, rpc } = mockClient((name) => ({ data: name === "recurring_csv_snapshot" ? { revision: 2, events: all } : { ...base, analysis_status: "succeeded" }, error: null }));
    expect((await analyzeSyncRun(client, base, { client, actorId: "verified-user" })).analysis_status).toBe("succeeded");
    expect(rpc.mock.calls[1][1].p_result).toMatchObject({ metrics: { eventCount: 120, caseCount: 60 } });
  });
  it("analysis failure is recorded separately and never invokes ingestion again", async () => {
    const { client, rpc } = mockClient((name) => name === "recurring_csv_snapshot" ? { data: null, error: {} } : { data: { ...base, analysis_status: "failed" }, error: null });
    expect((await analyzeSyncRun(client, base, { client, actorId: "verified-user" })).analysis_status).toBe("failed");
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["recurring_csv_snapshot", "recurring_csv_analysis_server"]);
    expect(rpc.mock.calls[1][1].p_result).toBeNull();
  });
  it("already analyzed revision is skipped", async () => {
    const { client, rpc } = mockClient(() => ({ data: null, error: null }));
    await analyzeSyncRun(client, base, { client, actorId: "verified-user" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("schema drift closes the run without archive or merge", async () => {
    const { client, rpc, upload } = mockClient((name) => ({ data: name === "recurring_csv_start" ? { ...base, status: "running" } : { ...base, status: "failed", accepted_count: 0 }, error: null }));
    const result = await synchronizeRecurringCsv({ client, writer: { client, actorId: "verified-user" }, connectorId: "connector-1", file: new File([ordersSync01.replace("pedido_id", "missing")], "orders.csv"), mapping: { canonical_mapping: demoSyncMapping, identity_config: demoSyncIdentity, source_schema_hash: "" } });
    expect(result.run.status).toBe("failed");
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["recurring_csv_start", "recurring_csv_fail"]);
    expect(rpc.mock.calls[1][1].p_code).toBe("schema_drift");
    expect(upload).not.toHaveBeenCalled();
  });
  it("storage error closes run without ingesting", async () => {
    const { client, rpc } = mockClient((name) => ({ data: name === "recurring_csv_start" ? { ...base, status: "running" } : { ...base, status: "failed", accepted_count: 0 }, error: null }), {});
    await synchronizeRecurringCsv({ client, writer: { client, actorId: "verified-user" }, connectorId: "connector-1", file: new File([ordersSync01], "orders.csv"), mapping: { canonical_mapping: demoSyncMapping, identity_config: demoSyncIdentity, source_schema_hash: "" } });
    expect(rpc.mock.calls[1][1].p_code).toBe("storage_failed");
    expect(rpc.mock.calls.map((call) => call[0])).not.toContain("recurring_csv_merge_server");
  });
  it("lost merge response recovers committed run, preserving ingestion", async () => {
    const { client, rpc } = mockClient((name) => name === "recurring_csv_merge_server" ? { error: {}, data: null } : { error: null, data: name === "recurring_csv_snapshot" ? null : name === "recurring_csv_start" ? { ...base, status: "running" } : base });
    const result = await synchronizeRecurringCsv({ client, writer: { client, actorId: "verified-user" }, connectorId: "connector-1", file: new File([ordersSync01], "orders.csv"), mapping: { canonical_mapping: demoSyncMapping, identity_config: demoSyncIdentity, source_schema_hash: "" } });
    expect(result.run.status).toBe("succeeded");
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["recurring_csv_start", "recurring_csv_merge_server", "recurring_csv_fail", "recurring_csv_snapshot"]);
  });
});
