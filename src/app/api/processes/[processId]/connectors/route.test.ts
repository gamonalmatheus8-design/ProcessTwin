import { beforeEach, describe, expect, it, vi } from "vitest";
import { ordersSync01, demoSyncMapping, demoSyncIdentity } from "@/features/sync/demo-data";

const mock = vi.hoisted(() => ({ user: { id: "user-1" } as { id: string } | null, memberRole: "owner", organizationOwner: "user-1", process: true, rpc: vi.fn(), synchronize: vi.fn(), analyze: vi.fn(), eq: vi.fn(), writer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mock.user }, error: null }) }, rpc: mock.rpc, from: (table: string) => {
  const value = table === "processes" ? mock.process ? { id: "11111111-1111-4111-8111-111111111111", organization_id: "org-1" } : null
    : table === "organizations" ? { created_by: mock.organizationOwner } : table === "organization_members" ? { role: mock.memberRole }
    : table === "connectors" ? { id: "22222222-2222-4222-8222-222222222222" } : table === "connector_mappings" ? { canonical_mapping: demoSyncMapping, identity_config: demoSyncIdentity, source_schema_hash: "a".repeat(64) } : null;
  const query = { select: () => query, eq: (key: string, value: unknown) => { mock.eq(table, key, value); return query; }, maybeSingle: async () => ({ data: value, error: null }), single: async () => ({ data: value, error: null }) }; return query;
} }) }));
vi.mock("@/lib/supabase/sync-writer", () => ({ createSyncWriter: mock.writer }));
vi.mock("@/features/sync/service", () => ({ synchronizeRecurringCsv: mock.synchronize, analyzeSyncRun: mock.analyze, syncMessage: () => "ok" }));
import { POST } from "./route";
const processId = "11111111-1111-4111-8111-111111111111";
function request(form = new FormData()) { return new Request(`http://localhost/api/processes/${processId}/connectors`, { method: "POST", body: form }); }
function form() { const data = new FormData(); data.set("file", new File([ordersSync01], "orders.csv", { type: "text/csv" })); data.set("connectorId", "22222222-2222-4222-8222-222222222222"); return data; }
const context = { params: Promise.resolve({ processId }) };
beforeEach(() => { mock.user = { id: "user-1" }; mock.memberRole = "owner"; mock.organizationOwner = "user-1"; mock.process = true; vi.clearAllMocks(); mock.writer.mockReturnValue({ actorId: "user-1", client: {} }); mock.synchronize.mockResolvedValue({ run: { status: "succeeded" } }); });
describe("recurring CSV API authorization and validation", () => {
  it("writer uses the verified user, ignoring a caller-supplied actor", async () => {
    const data = form(); data.set("actorId", "outsider");
    expect((await POST(request(data), context)).status).toBe(200);
    expect(mock.writer).toHaveBeenCalledWith("user-1");
    expect(mock.synchronize.mock.calls[0][0].writer.actorId).toBe("user-1");
  });
  it("missing server configuration fails before creating or starting a connector", async () => {
    mock.writer.mockImplementationOnce(() => { throw new Error("secret details"); });
    const response = await POST(request(form()), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret details");
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.synchronize).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => { mock.user = null; expect((await POST(request(), context)).status).toBe(401); });
  it.each(["analyst", "viewer"])("enforces %s restrictions on backend", async (role) => { mock.memberRole = role; mock.organizationOwner = "someone-else"; expect((await POST(request(), context)).status).toBe(403); expect(mock.synchronize).not.toHaveBeenCalled(); });
  it("returns 404 for invisible process", async () => { mock.process = false; expect((await POST(request(), context)).status).toBe(404); });
  it("rejects cross-origin uploads", async () => { const req = request(); req.headers.set("origin", "http://evil.example"); expect((await POST(req, context)).status).toBe(403); });
  it("rejects non-multipart payloads and invalid process IDs", async () => { expect((await POST(new Request("http://localhost/api", { method: "POST", body: "{}" }), context)).status).toBe(415); expect((await POST(request(), { params: Promise.resolve({ processId: "bad" }) })).status).toBe(400); });
  it("requires CSV file", async () => { expect((await POST(request(), context)).status).toBe(415); });
  it("resync uses stored mapping and identity, scoped to process and organization", async () => {
    const data = form(); data.set("mapping", '{"caseId":"attacker"}'); data.set("identity", '{"strategy":"row_number"}');
    expect((await POST(request(data), context)).status).toBe(200);
    expect(mock.synchronize.mock.calls[0][0].mapping.canonical_mapping).toEqual(demoSyncMapping);
    expect(mock.eq).toHaveBeenCalledWith("connectors", "process_id", processId);
    expect(mock.eq).toHaveBeenCalledWith("connectors", "organization_id", "org-1");
  });
  it("failed runs remain visible as a structured 422 response", async () => {
    mock.synchronize.mockResolvedValue({ run: { status: "failed", error_message: "O arquivo mudou e o mapeamento precisa ser revisado." } });
    const response = await POST(request(form()), context); expect(response.status).toBe(422); expect((await response.json()).run.status).toBe("failed");
  });
});
