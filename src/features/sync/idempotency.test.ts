import { describe, expect, it } from "vitest";
import {
  buildEventIdempotency,
  buildSourceEventKey,
  buildSourcePayloadHash,
  decideIdempotencyAction,
  stableSerialize,
  type CanonicalSyncEvent,
} from "./idempotency";

const event: CanonicalSyncEvent = {
  caseId: "P-501",
  activity: "Aprovação",
  timestamp: "2026-09-01T12:00:00Z",
  resource: "Ana",
  lifecycle: null,
  status: "approved",
  cost: 12.5,
  metadata: { channel: "web", priority: 2 },
};

describe("sync idempotency", () => {
  it("serializes object keys deterministically", () => {
    expect(stableSerialize({ b: 2, a: 1 })).toBe(
      stableSerialize({ a: 1, b: 2 }),
    );
  });

  it("builds the same source-id key for retries", () => {
    const first = buildSourceEventKey({
      strategy: "source_id",
      sourceId: " evt-928 ",
    });
    const second = buildSourceEventKey({
      strategy: "source_id",
      sourceId: "evt-928",
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^source-id:v1:[0-9a-f]{64}$/);
  });

  it("builds source-field identity independent of field order", () => {
    const record = {
      ticket_id: "T-9",
      status: "Resolvido",
      event_time: "2026-09-01T12:00:00Z",
    };
    const first = buildSourceEventKey({
      strategy: "source_fields",
      record,
      fields: ["ticket_id", "status", "event_time"],
    });
    const second = buildSourceEventKey({
      strategy: "source_fields",
      record,
      fields: ["event_time", "ticket_id", "status"],
    });
    expect(first).toBe(second);
  });

  it("rejects an incomplete selected-field identity", () => {
    expect(() =>
      buildSourceEventKey({
        strategy: "source_fields",
        record: { ticket_id: "T-9", status: "" },
        fields: ["ticket_id", "status"],
      }),
    ).toThrow(/status/);
  });

  it("normalizes canonical timestamps before fingerprinting", () => {
    const first = buildSourceEventKey({
      strategy: "canonical_fingerprint",
      event,
    });
    const second = buildSourceEventKey({
      strategy: "canonical_fingerprint",
      event: { ...event, timestamp: "2026-09-01T09:00:00-03:00" },
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^canonical:v1:[0-9a-f]{64}$/);
  });

  it("keeps metadata out of identity but inside payload hash", () => {
    const keyA = buildSourceEventKey({
      strategy: "canonical_fingerprint",
      event,
    });
    const keyB = buildSourceEventKey({
      strategy: "canonical_fingerprint",
      event: { ...event, metadata: { channel: "store" } },
    });
    expect(keyA).toBe(keyB);

    const hashA = buildSourcePayloadHash(event);
    const hashB = buildSourcePayloadHash({
      ...event,
      metadata: { channel: "store" },
    });
    expect(hashA).not.toBe(hashB);
  });

  it("produces the same payload hash regardless of metadata key order", () => {
    expect(
      buildSourcePayloadHash({
        ...event,
        metadata: { priority: 2, channel: "web" },
      }),
    ).toBe(buildSourcePayloadHash(event));
  });

  it("classifies insert, duplicate and update correctly", () => {
    const incoming = buildSourcePayloadHash(event);
    expect(decideIdempotencyAction(null, incoming)).toBe("insert");
    expect(decideIdempotencyAction(incoming, incoming)).toBe("duplicate");
    expect(decideIdempotencyAction("0".repeat(64), incoming)).toBe("update");
  });

  it("keeps the event key stable when mutable payload changes", () => {
    const original = buildEventIdempotency(
      { strategy: "source_id", sourceId: "provider-event-77" },
      event,
    );
    const corrected = buildEventIdempotency(
      { strategy: "source_id", sourceId: "provider-event-77" },
      { ...event, resource: "Bruno", cost: 14 },
    );

    expect(corrected.sourceEventKey).toBe(original.sourceEventKey);
    expect(corrected.sourcePayloadHash).not.toBe(original.sourcePayloadHash);
    expect(
      decideIdempotencyAction(
        original.sourcePayloadHash,
        corrected.sourcePayloadHash,
      ),
    ).toBe("update");
  });

  it("rejects non-finite payload values", () => {
    expect(() =>
      buildSourcePayloadHash({ ...event, cost: Number.POSITIVE_INFINITY }),
    ).toThrow(/NaN or Infinity/);
  });
});
