import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ token: vi.fn(), credentials: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    setCredentials = mock.credentials;
    getAccessToken = mock.token;
  },
}));
vi.mock("./security", () => ({
  appOrigin: () => "https://app.example",
  sheetsReady: () => true,
}));
import { fetchSheet } from "./google";
const source = { spreadsheetId: "a".repeat(30), sheetName: "Orders" };
const grid = [
  ["id", "case", "activity", "time"],
  ["1", "c1", "Opened", "2026-09-01T00:00:00Z"],
];
beforeEach(() => {
  vi.clearAllMocks();
  mock.token.mockResolvedValue({ token: "access-token" });
});
afterEach(() => vi.unstubAllEnvs());
describe("Google API reads and bounded recovery", () => {
  it("sends credentials only in a header to the fixed Google host and never follows redirects", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ values: grid }));
    expect(await fetchSheet(source, "refresh-secret", fetcher)).toContain(
      "Opened",
    );
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/sheets.googleapis.com\//);
    expect(String(url)).not.toContain("token");
    expect(options).toEqual(
      expect.objectContaining({
        redirect: "error",
        cache: "no-store",
        headers: { Authorization: "Bearer access-token" },
      }),
    );
  });
  it("retries a temporary GET once and preserves permanent permission errors", async () => {
    const temporary = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ values: grid }));
    await fetchSheet(source, "refresh", temporary);
    expect(temporary).toHaveBeenCalledTimes(2);
    const denied = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 403 }));
    await expect(fetchSheet(source, "refresh", denied)).rejects.toThrow(
      "source_unavailable",
    );
    expect(denied).toHaveBeenCalledTimes(1);
  });
  it("stops after two temporary failures and classifies revoked Google authorization", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network"));
    await expect(fetchSheet(source, "refresh", fetcher)).rejects.toThrow(
      "source_temporary",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    mock.token.mockRejectedValue({ response: { status: 400 } });
    await expect(fetchSheet(source, "refresh", fetcher)).rejects.toThrow(
      "needs_reauth",
    );
  });
});
