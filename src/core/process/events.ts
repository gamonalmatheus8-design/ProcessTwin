import type { ProcessEvent } from "./types";

export class InvalidProcessEventError extends TypeError {
  constructor(index: number) {
    super(`Invalid process event at index ${index}`);
    this.name = "InvalidProcessEventError";
  }
}

export function isProcessEvent(value: unknown): value is ProcessEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Record<string, unknown>;
  const hasValidResource =
    event.resource === undefined ||
    event.resource === null ||
    typeof event.resource === "string";

  return (
    typeof event.caseId === "string" &&
    event.caseId.trim().length > 0 &&
    typeof event.activity === "string" &&
    event.activity.trim().length > 0 &&
    typeof event.timestamp === "string" &&
    Number.isFinite(Date.parse(event.timestamp)) &&
    hasValidResource
  );
}

const compareEvents = (left: ProcessEvent, right: ProcessEvent) =>
  Date.parse(left.timestamp) - Date.parse(right.timestamp) ||
  left.activity.localeCompare(right.activity, "pt-BR") ||
  (left.resource ?? "").localeCompare(right.resource ?? "", "pt-BR");

export function groupAndOrderEvents(
  events: readonly ProcessEvent[],
): Array<[caseId: string, events: ProcessEvent[]]> {
  const grouped = new Map<string, ProcessEvent[]>();

  events.forEach((event, index) => {
    if (!isProcessEvent(event)) throw new InvalidProcessEventError(index);

    const caseEvents = grouped.get(event.caseId) ?? [];
    caseEvents.push(event);
    grouped.set(event.caseId, caseEvents);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "pt-BR"))
    .map(([caseId, caseEvents]) => [caseId, [...caseEvents].sort(compareEvents)]);
}
