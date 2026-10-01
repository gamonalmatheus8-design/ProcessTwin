import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  access: vi.fn(),
  ready: true,
  rpc: vi.fn(),
  preview: vi.fn(),
  sync: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@/features/google-sheets/access", async (original) => ({
  ...(await original<typeof import("@/features/google-sheets/access")>()),
  sheetsAccess: mock.access,
}));
vi.mock("@/features/google-sheets/security", async (original) => ({
  ...(await original<typeof import("@/features/google-sheets/security")>()),
  sheetsReady: () => mock.ready,
}));
vi.mock("@/features/google-sheets/service", () => ({
  sheetsRpc: mock.rpc,
  sheetPreview: mock.preview,
  synchronizeSheet: mock.sync,
  loadSheetConnector: mock.load,
  analyzeSheetRun: vi.fn(),
}));
import { POST } from "./route";
import {
  ordersSync01,
  demoSyncMapping,
  demoSyncIdentity,
} from "@/features/sync/demo-data";
import { prepareRecurringCsv } from "@/features/sync/recurring-csv";
const processId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ processId }) };
const source = { spreadsheetId: "a".repeat(30), sheetName: "Orders" };
function request(body: unknown, origin = "http://localhost") {
  return new Request(`http://localhost/api/processes/${processId}/sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.ready = true;
  mock.access.mockResolvedValue({
    writer: { actorId: "verified-owner", client: {} },
  });
  mock.preview.mockResolvedValue(ordersSync01);
  mock.rpc.mockResolvedValue({ connectorId: "created-connector" });
  mock.sync.mockResolvedValue({ run: { status: "succeeded" } });
});
describe("Sheets setup confirmation and tenant boundary", () => {
  it("rejects cross-origin mutation before authentication and private data access", async () => {
    expect(
      (
        await POST(
          request({ action: "preview" }, "https://evil.example"),
          context,
        )
      ).status,
    ).toBe(403);
    expect(mock.access).not.toHaveBeenCalled();
  });
  it.each(["unauthorized", "forbidden", "not_found"])(
    "enforces %s before Google access",
    async (message) => {
      mock.access.mockRejectedValue(new Error(message));
      expect(
        (await POST(request({ action: "preview", source }), context)).status,
      ).not.toBe(200);
      expect(mock.preview).not.toHaveBeenCalled();
    },
  );
  it("fails before source access or connector creation when secrets are missing", async () => {
    mock.ready = false;
    expect((await POST(request({ action: "create" }), context)).status).toBe(
      503,
    );
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.preview).not.toHaveBeenCalled();
  });
  it("returns a bounded preview without creating or starting a connector", async () => {
    const response = await POST(
      request({ action: "preview", source }),
      context,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(100);
    expect(body.sampleCsv.split("\n").length).toBe(51);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.sync).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation of the fresh source schema", async () => {
    const body = {
      action: "create",
      source,
      name: "Orders",
      schedule: null,
      mapping: demoSyncMapping,
      identity: demoSyncIdentity,
    };
    expect((await POST(request(body), context)).status).toBe(409);
    expect(
      (
        await POST(
          request({ ...body, confirmed: true, schemaHash: "stale" }),
          context,
        )
      ).status,
    ).toBe(409);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("creates only after confirmation, derives actor from session and validates the full dataset", async () => {
    const schemaHash = prepareRecurringCsv(
      ordersSync01,
      demoSyncMapping,
      demoSyncIdentity,
    ).schemaHash;
    const response = await POST(
      request({
        action: "create",
        source,
        name: "Orders",
        schedule: 1440,
        mapping: demoSyncMapping,
        identity: demoSyncIdentity,
        schemaHash,
        confirmed: true,
        actorId: "attacker",
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "verified-owner" }),
      "sheets_create_server",
      expect.objectContaining({ p_schedule: 1440, p_process: processId }),
    );
    expect(mock.sync).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "verified-owner" }),
      processId,
      "created-connector",
    );
  });
});
