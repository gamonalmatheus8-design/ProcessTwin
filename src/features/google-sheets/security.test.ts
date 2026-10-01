import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { appOrigin, seal, secretMatches, stateHash, unseal } from "./security";
beforeEach(() =>
  vi.stubEnv(
    "CONNECTOR_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64"),
  ),
);
afterEach(() => vi.unstubAllEnvs());
describe("connector credential encryption and scheduler authentication", () => {
  it("binds ciphertext to actor and process, authenticates tampering and uses a fresh nonce", () => {
    const a = seal("refresh-token", "credential:process-a:owner-a"),
      b = seal("refresh-token", "credential:process-a:owner-a");
    expect(a).not.toContain("refresh-token");
    expect(a).not.toBe(b);
    expect(unseal(a, "credential:process-a:owner-a")).toBe("refresh-token");
    expect(() => unseal(a, "credential:process-b:owner-a")).toThrow();
    expect(() => unseal(a, "state:process-a:owner-a")).toThrow();
    const parts = a.split(".");
    parts[2] = Buffer.alloc(16, 2).toString("base64url");
    expect(() =>
      unseal(parts.join("."), "credential:process-a:owner-a"),
    ).toThrow();
  });
  it("fails closed without a valid 256-bit encryption key", () => {
    vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "bad");
    expect(() => seal("token", "context")).toThrow();
  });
  it("requires a configured bearer secret and never accepts undefined or short secrets", () => {
    expect(secretMatches("Bearer undefined", undefined)).toBe(false);
    expect(secretMatches("Bearer short", "short")).toBe(false);
    expect(secretMatches(`Bearer ${"x".repeat(32)}`, "x".repeat(32))).toBe(
      true,
    );
    expect(secretMatches(`Bearer ${"y".repeat(32)}`, "x".repeat(32))).toBe(
      false,
    );
  });
  it("requires a trusted origin with no redirect path or credentials", () => {
    vi.stubEnv("APP_ORIGIN", "https://process.example");
    expect(appOrigin()).toBe("https://process.example");
    for (const value of [
      "http://evil.example",
      "https://user:password@example.com",
      "https://example.com/redirect",
    ]) {
      vi.stubEnv("APP_ORIGIN", value);
      expect(() => appOrigin()).toThrow();
    }
    expect(stateHash("nonce")).toMatch(/^[a-f0-9]{64}$/);
  });
});
