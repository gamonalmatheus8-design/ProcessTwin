import { describe, expect, it } from "vitest";
import { demoEvents, demoScenario } from "@/data/demo-process";
import { GET, POST } from "./route";

describe("/api/demo-cycle", () => {
  it("GET returns the complete demo cycle", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.model.nodes.length).toBeGreaterThan(0);
    expect(body.metrics).toEqual(body.model.metrics);
    expect(body.bottleneck.activity).toBe("Aprovação");
    expect(body.simulation.simulated.avgCycleSeconds).toBeLessThan(
      body.simulation.baseline.avgCycleSeconds,
    );
    expect(body.impact).toEqual(body.simulation.impactSummary);
  });

  it("POST accepts events in the documented format", async () => {
    const response = await POST(
      new Request("http://localhost/api/demo-cycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: demoEvents }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.metrics.eventCount).toBe(demoEvents.length);
    expect(body.bottleneck.activity).toBe("Aprovação");
    expect(body.simulation.simulated.avgCycleSeconds).toBeLessThan(
      body.simulation.baseline.avgCycleSeconds,
    );
  });

  it("POST rejects invalid timestamps and malformed JSON", async () => {
    const invalidTimestamp = await POST(
      new Request("http://localhost/api/demo-cycle", {
        method: "POST",
        body: JSON.stringify({
          events: [{ caseId: "PED-001", activity: "Aprovação", timestamp: "invalid" }],
        }),
      }),
    );
    const malformedJson = await POST(
      new Request("http://localhost/api/demo-cycle", { method: "POST", body: "{" }),
    );

    expect(invalidTimestamp.status).toBe(400);
    expect(malformedJson.status).toBe(400);
  });
});
