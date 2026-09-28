import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/import/process-events", () => {
  it("rejeita payload que não é multipart", async () => {
    const response = await POST(new Request("http://localhost/api/import/process-events", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    }));
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });
});
