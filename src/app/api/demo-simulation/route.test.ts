import { describe, expect, it } from "vitest";
import { POST } from "./route";

const payload = {
  name: "Demo aprovação",
  activity: "Aprovação",
  waitReductionPct: 30,
  capacityMultiplier: 1.5,
};

describe("/api/demo-simulation", () => {
  it("runs the shared engine without persistence", async () => {
    const response = await POST(
      new Request("http://localhost/api/demo-simulation", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.simulated.avgCycleSeconds).toBeLessThan(
      body.result.baseline.avgCycleSeconds,
    );
    expect(body.payload).toEqual(payload);
  });

  it("rejects unknown activities", async () => {
    const response = await POST(
      new Request("http://localhost/api/demo-simulation", {
        method: "POST",
        body: JSON.stringify({ ...payload, activity: "Inexistente" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
