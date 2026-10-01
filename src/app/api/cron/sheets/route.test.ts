import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ rpc: vi.fn(), sync: vi.fn(), ready: true }));
vi.mock("@/lib/supabase/sync-writer", () => ({
  createSyncWriter: () => ({ client: { rpc: mock.rpc }, actorId: "scheduler" }),
}));
vi.mock("@/features/google-sheets/service", () => ({
  synchronizeSheet: mock.sync,
}));
vi.mock("@/features/google-sheets/security", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/google-sheets/security")
  >()),
  sheetsReady: () => mock.ready,
}));
import { GET } from "./route";
const secret = "x".repeat(32);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  vi.stubEnv("SHEETS_SCHEDULER_ENABLED", "true");
  vi.stubEnv("VERCEL_ENV", "production");
  mock.ready = true;
  mock.rpc.mockResolvedValue({
    data: [
      { id: "connector", actorId: "stored-owner", processId: "stored-process" },
    ],
    error: null,
  });
  mock.sync.mockResolvedValue({
    run: { status: "succeeded", analysis_status: "skipped" },
  });
});
describe("scheduled sync execution boundary", () => {
  it("requires the exact configured secret before database access", async () => {
    expect(
      (await GET(new Request("https://app.example/api/cron/sheets"))).status,
    ).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each(["preview", "disabled", "unconfigured"])(
    "blocks %s unattended writes",
    async (state) => {
      if (state === "preview") vi.stubEnv("VERCEL_ENV", "preview");
      if (state === "disabled") vi.stubEnv("SHEETS_SCHEDULER_ENABLED", "false");
      if (state === "unconfigured") mock.ready = false;
      expect(
        (
          await GET(
            new Request("https://app.example/api/cron/sheets", {
              headers: { authorization: `Bearer ${secret}` },
            }),
          )
        ).status,
      ).toBe(503);
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
  it("derives the scheduled actor and process exclusively from claimed database entities", async () => {
    const response = await GET(
      new Request("https://app.example/api/cron/sheets?actorId=attacker", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(mock.sync).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "stored-owner" }),
      "stored-process",
      "connector",
      "scheduled",
    );
  });
  it("isolates a failed connector and returns no Google credentials or raw errors", async () => {
    mock.sync.mockRejectedValue(new Error("secret refresh token"));
    const response = await GET(
      new Request("https://app.example/api/cron/sheets", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret refresh token",
    );
  });
});
