import { describe, expect, it } from "vitest";
import { safeAuthNext } from "./redirect";

describe("authentication return destination", () => {
  it("returns to the connector that requested login", () => {
    expect(safeAuthNext("/processes/pilot/connectors")).toBe("/processes/pilot/connectors");
  });
  it("preserves an internal query and fragment", () => {
    expect(safeAuthNext("/processes/new?pack=orders#upload")).toBe("/processes/new?pack=orders#upload");
  });
  it.each([undefined, null, 42, "", "https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/%5cevil.invalid", "/%255cevil.invalid", "/%2f%2fevil.invalid", "/\nevil.invalid", "/auth", "/auth/callback", "/bad%", "/" + "a".repeat(2048)])("rejects unsafe or looping destinations: %s", (value) => {
    expect(safeAuthNext(value)).toBe("/processes/new");
  });
});
