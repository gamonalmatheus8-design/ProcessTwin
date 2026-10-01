import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  cookie: "nonce:11111111-1111-4111-8111-111111111111",
  set: vi.fn(),
  rpc: vi.fn(),
  access: vi.fn(),
  token: vi.fn(),
  info: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: mock.cookie }), set: mock.set }),
}));
vi.mock("@/features/google-sheets/access", () => ({
  sheetsAccess: mock.access,
}));
vi.mock("@/features/google-sheets/security", () => ({
  appOrigin: () => "https://app.example",
  seal: () => "encrypted-refresh",
  stateHash: () => "hashed-nonce",
  unseal: () => "pkce-verifier",
  UUID: /^[a-f0-9-]{36}$/i,
}));
vi.mock("@/features/google-sheets/google", () => ({
  SHEETS_SCOPE: "readonly",
  googleClient: () => ({ getToken: mock.token, getTokenInfo: mock.info }),
}));
vi.mock("@/features/google-sheets/service", () => ({ sheetsRpc: mock.rpc }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mock.cookie = "nonce:11111111-1111-4111-8111-111111111111";
  mock.access.mockResolvedValue({ writer: { actorId: "verified-owner" } });
  mock.rpc.mockResolvedValue("encrypted-state");
  mock.token.mockResolvedValue({
    tokens: { refresh_token: "refresh-secret", access_token: "access-secret" },
  });
  mock.info.mockResolvedValue({ scopes: ["readonly"] });
});
afterEach(() => vi.restoreAllMocks());
describe("Google authorization callback state and token handling", () => {
  it("logs only the failing stage and allowlisted provider code, never OAuth secrets", async () => {
    mock.token.mockRejectedValueOnce({
      message: "client-secret access-secret refresh-secret code nonce",
      response: { data: { error: "invalid_client", error_description: "client-secret" } },
      config: { data: "client_secret=client-secret&code=code" },
    });
    const response = await GET(new Request(
      "https://app.example/api/connectors/google/callback?state=nonce&code=code",
    ));
    expect(response.headers.get("location")).toContain("google=failed");
    expect(console.warn).toHaveBeenCalledWith("Google OAuth callback failed", {
      stage: "token_exchange", providerError: "invalid_client",
    });
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    for (const secret of ["client-secret", "access-secret", "refresh-secret", "nonce"])
      expect(logged).not.toContain(secret);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not log an unrecognized provider error value", async () => {
    mock.token.mockRejectedValueOnce({ response: { data: { error: "secret-in-error" } } });
    await GET(new Request("https://app.example/api/connectors/google/callback?state=nonce&code=code"));
    expect(console.warn).toHaveBeenCalledWith("Google OAuth callback failed", {
      stage: "token_exchange", providerError: "unclassified",
    });
  });
  it("rejects a mismatched browser nonce without exchanging the code", async () => {
    expect(
      (
        await GET(
          new Request(
            "https://app.example/api/connectors/google/callback?state=attacker&code=code",
          ),
        )
      ).status,
    ).toBe(400);
    expect(mock.access).not.toHaveBeenCalled();
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("consumes server state before exchange and uses PKCE; never sends tokens to the redirect", async () => {
    const response = await GET(
      new Request(
        "https://app.example/api/connectors/google/callback?state=nonce&code=code",
      ),
    );
    expect(mock.rpc.mock.calls[0][1]).toBe("sheets_oauth_state_server");
    expect(mock.token).toHaveBeenCalledWith({
      code: "code",
      codeVerifier: "pkce-verifier",
    });
    expect(mock.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "verified-owner" }),
      "sheets_credential_server",
      expect.objectContaining({ p_cipher: "encrypted-refresh" }),
    );
    expect(response.headers.get("location")).toBe(
      "https://app.example/processes/11111111-1111-4111-8111-111111111111/connectors?google=connected",
    );
    expect(mock.set).toHaveBeenCalledWith(
      "pt-google-state",
      "",
      expect.objectContaining({
        maxAge: 0,
        path: "/api/connectors/google/callback",
      }),
    );
  });
  it("does not exchange an expired or replayed OAuth state", async () => {
    mock.rpc.mockRejectedValueOnce(new Error("Invalid OAuth state"));
    const response = await GET(
      new Request(
        "https://app.example/api/connectors/google/callback?state=nonce&code=code",
      ),
    );
    expect(response.headers.get("location")).toContain("google=failed");
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("requires offline authorization and the granted read-only scope before storing credentials", async () => {
    mock.info.mockResolvedValue({ scopes: [] });
    const response = await GET(
      new Request(
        "https://app.example/api/connectors/google/callback?state=nonce&code=code",
      ),
    );
    expect(response.headers.get("location")).toContain("google=failed");
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
});
