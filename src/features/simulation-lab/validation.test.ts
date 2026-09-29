import { describe, expect, it } from "vitest";
import { validateSimulationPayload } from "./validation";

const validPayload = {
  name: "Melhorar aprovação",
  description: "Hipótese operacional",
  activity: "Aprovação",
  waitReductionPct: 30,
  capacityMultiplier: 1.5,
  slaThresholdSeconds: 28_800,
};

describe("validateSimulationPayload", () => {
  it("accepts a valid payload", () => {
    expect(validateSimulationPayload(validPayload, ["Aprovação"])).toEqual({
      ok: true,
      value: validPayload,
    });
  });

  it("rejects an activity outside the model", () => {
    expect(validateSimulationPayload(validPayload, ["Triagem"])).toMatchObject({ ok: false });
  });

  it.each([-1, 81])("rejects waitReductionPct %s", (waitReductionPct) => {
    expect(validateSimulationPayload({ ...validPayload, waitReductionPct })).toMatchObject({
      ok: false,
    });
  });

  it.each([0.9, 3.1])("rejects capacityMultiplier %s", (capacityMultiplier) => {
    expect(validateSimulationPayload({ ...validPayload, capacityMultiplier })).toMatchObject({
      ok: false,
    });
  });

  it.each([0, -1, "3600"])('rejects invalid SLA "%s"', (slaThresholdSeconds) => {
    expect(validateSimulationPayload({ ...validPayload, slaThresholdSeconds })).toMatchObject({
      ok: false,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-finite wait reduction %s",
    (waitReductionPct) => {
      expect(validateSimulationPayload({ ...validPayload, waitReductionPct })).toMatchObject({
        ok: false,
      });
    },
  );

  it.each([Number.NaN, Number.NEGATIVE_INFINITY])(
    "rejects non-finite capacity %s",
    (capacityMultiplier) => {
      expect(validateSimulationPayload({ ...validPayload, capacityMultiplier })).toMatchObject({
        ok: false,
      });
    },
  );

  it("rejects an empty name", () => {
    expect(validateSimulationPayload({ ...validPayload, name: "  " })).toMatchObject({
      ok: false,
    });
  });
});
