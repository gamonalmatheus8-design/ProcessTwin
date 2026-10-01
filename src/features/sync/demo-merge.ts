import { runCoreCycle } from "@/core/process/cycle";
import { decideIdempotencyAction } from "./idempotency";
import type { SyncRecord } from "./types";

export type DemoEvent = SyncRecord & { eventIndex: number };
// In-memory illustration only. Production atomicity is tested against the PostgreSQL RPC.
export function mergeDemoEvents(existing: DemoEvent[], incoming: SyncRecord[]) {
  const store = new Map(existing.map((event) => [event.sourceEventKey, { ...event }]));
  let accepted = 0, duplicate = 0, updated = 0;
  let nextIndex = Math.max(-1, ...existing.map((event) => event.eventIndex)) + 1;
  for (const event of incoming) {
    const previous = store.get(event.sourceEventKey);
    const action = decideIdempotencyAction(previous?.sourcePayloadHash, event.sourcePayloadHash);
    if (action === "duplicate") { duplicate++; continue; }
    if (action === "insert") { store.set(event.sourceEventKey, { ...event, eventIndex: nextIndex++ }); accepted++; }
    else { store.set(event.sourceEventKey, { ...event, eventIndex: previous!.eventIndex }); updated++; }
  }
  const events = [...store.values()].sort((a, b) => a.eventIndex - b.eventIndex);
  return { events, accepted, duplicate, updated, analysis: accepted + updated > 0 ? runCoreCycle(events) : null };
}
