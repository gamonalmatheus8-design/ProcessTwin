import { describe, expect, it } from "vitest";
import { demoIds } from "@/features/demo-center/datasets";
import { GET } from "./route";
describe("public synthetic exports", () => {
  it.each(demoIds)(
    "exports %s with a synthetic filename and complete header",
    async (scenario) => {
      const response = await GET(new Request("http://localhost/"), {
        params: Promise.resolve({ scenario }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toBe(
        `attachment; filename="synthetic-${scenario}.csv"`,
      );
      expect((await response.text()).split("\r\n")[0]).toBe(
        "event_id,case_id,activity,timestamp,resource,priority,category",
      );
    },
  );
  it("rejects unknown scenario", async () => {
    expect(
      (
        await GET(new Request("http://localhost/"), {
          params: Promise.resolve({ scenario: "unknown" }),
        })
      ).status,
    ).toBe(404);
  });
});
