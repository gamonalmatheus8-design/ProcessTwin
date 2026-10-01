import { createSyncWriter } from "@/lib/supabase/sync-writer";
import { secretMatches, sheetsReady } from "@/features/google-sheets/security";
import { synchronizeSheet } from "@/features/google-sheets/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !secretMatches(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Preview never performs unattended writes against the shared remote database.
  if (
    process.env.VERCEL_ENV === "preview" ||
    process.env.SHEETS_SCHEDULER_ENABLED !== "true" ||
    !sheetsReady()
  )
    return Response.json({ error: "Scheduler inactive" }, { status: 503 });
  try {
    const scheduler = createSyncWriter("scheduler");
    const { data, error } = await scheduler.client.rpc("sheets_due_server", {
      p_limit: 3,
    });
    if (error) throw new Error();
    const due = data as { id: string; actorId: string; processId: string }[];
    const results = await Promise.all(
      due.map(async (item) => {
        try {
          const result = await synchronizeSheet(
            { client: scheduler.client, actorId: item.actorId },
            item.processId,
            item.id,
            "scheduled",
          );
          return {
            connectorId: item.id,
            status: result.run.status,
            analysisStatus: result.run.analysis_status,
          };
        } catch {
          return { connectorId: item.id, status: "unavailable" };
        }
      }),
    );
    return Response.json(
      { processed: results.length, results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Scheduler unavailable" }, { status: 503 });
  }
}
