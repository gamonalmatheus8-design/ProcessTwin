import { NextResponse } from "next/server";
import { isProcessEvent } from "@/core/process/events";
import { mergeDemoEvents, type DemoEvent } from "@/features/sync/demo-merge";
import { demoSyncIdentity, demoSyncMapping, ordersSync01, ordersSync02 } from "@/features/sync/demo-data";
import { prepareRecurringCsv } from "@/features/sync/recurring-csv";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 200_000) return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
  try {
    const body = await request.json();
    if (![1, 2].includes(body.file) || !Array.isArray(body.events) || body.events.length > 120 || !body.events.every((event: unknown) => {
      const record = event as DemoEvent;
      return isProcessEvent(event) && Number.isInteger(record.eventIndex) && record.eventIndex >= 0 && typeof record.sourceEventKey === "string" && /^[0-9a-f]{64}$/.test(record.sourcePayloadHash);
    })) return NextResponse.json({ error: "Estado da demonstração inválido." }, { status: 400 });
    const batch = prepareRecurringCsv(body.file === 1 ? ordersSync01 : ordersSync02, demoSyncMapping, demoSyncIdentity);
    const merged = mergeDemoEvents(body.events, batch.records);
    return NextResponse.json({ ...merged, fetched: batch.fetched, invalid: batch.invalid });
  } catch { return NextResponse.json({ error: "Não foi possível executar a demonstração." }, { status: 400 }); }
}
