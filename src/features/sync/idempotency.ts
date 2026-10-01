import { createHash } from "node:crypto";

export type CanonicalSyncEvent = {
  caseId: string;
  activity: string;
  timestamp: string;
  resource?: string | null;
  lifecycle?: string | null;
  cost?: number | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
};

export type EventIdentityStrategy =
  | { strategy: "source_id"; sourceId: string }
  | {
      strategy: "source_fields";
      record: Record<string, unknown>;
      fields: string[];
    }
  | { strategy: "canonical_fingerprint"; event: CanonicalSyncEvent };

export type IdempotencyAction = "insert" | "duplicate" | "update";

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function normalizeStableValue(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Idempotency payload cannot contain NaN or Infinity.");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (typeof value === "bigint") return value.toString();

  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = normalizeStableValue(item);
      return normalized === undefined ? null : normalized;
    });
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = normalizeStableValue(
        (value as Record<string, unknown>)[key],
      );
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }

  throw new Error(`Unsupported idempotency value type: ${typeof value}`);
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeStableValue(value));
}

function requireText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} cannot be empty.`);
  return trimmed;
}

function canonicalIdentityPayload(event: CanonicalSyncEvent) {
  const timestamp = new Date(event.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Canonical event timestamp must be valid.");
  }

  return {
    caseId: requireText(event.caseId, "caseId"),
    activity: requireText(event.activity, "activity"),
    timestamp: timestamp.toISOString(),
    resource: event.resource?.trim() || null,
    lifecycle: event.lifecycle?.trim() || null,
    status: event.status?.trim() || null,
  };
}

function canonicalPayload(event: CanonicalSyncEvent) {
  return {
    ...canonicalIdentityPayload(event),
    cost: event.cost ?? null,
    metadata: event.metadata ?? {},
  };
}

export function buildSourceEventKey(input: EventIdentityStrategy): string {
  if (input.strategy === "source_id") {
    const sourceId = requireText(input.sourceId, "sourceId");
    return `source-id:v1:${sha256(stableSerialize(sourceId))}`;
  }

  if (input.strategy === "source_fields") {
    const fields = [...new Set(input.fields.map((field) => field.trim()))]
      .filter(Boolean)
      .sort();

    if (!fields.length) {
      throw new Error("At least one source identity field is required.");
    }

    const selected: Record<string, unknown> = {};
    for (const field of fields) {
      const value = input.record[field];
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && !value.trim())
      ) {
        throw new Error(`Source identity field "${field}" is empty.`);
      }
      selected[field] = value;
    }

    return `source-fields:v1:${sha256(stableSerialize(selected))}`;
  }

  return `canonical:v1:${sha256(
    stableSerialize(canonicalIdentityPayload(input.event)),
  )}`;
}

export function buildSourcePayloadHash(event: CanonicalSyncEvent): string {
  return sha256(stableSerialize(canonicalPayload(event)));
}

export function buildEventIdempotency(
  identity: EventIdentityStrategy,
  event: CanonicalSyncEvent,
) {
  return {
    sourceEventKey: buildSourceEventKey(identity),
    sourcePayloadHash: buildSourcePayloadHash(event),
  };
}

export function decideIdempotencyAction(
  existingPayloadHash: string | null | undefined,
  incomingPayloadHash: string,
): IdempotencyAction {
  if (!existingPayloadHash) return "insert";
  return existingPayloadHash === incomingPayloadHash ? "duplicate" : "update";
}
