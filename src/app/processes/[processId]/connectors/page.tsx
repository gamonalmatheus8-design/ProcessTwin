import { notFound, redirect } from "next/navigation";
import { ConnectorCenter } from "@/features/sync/components/connector-center";
import type { SyncRun } from "@/features/sync/types";
import { sheetsReady } from "@/features/google-sheets/security";
import { createClient } from "@/lib/supabase/server";

export default async function ConnectorsPage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
  params: Promise<{ processId: string }>;
}) {
  const { processId } = await params;
  const query = await searchParams;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    redirect(
      `/auth?next=${encodeURIComponent(`/processes/${processId}/connectors`)}`,
    );
  const { data: process } = await client
    .from("processes")
    .select("id,name,organization_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) notFound();
  const [
    { data: connectors, error },
    { data: runs, error: historyError },
    { data: datasets },
    { data: member },
    { data: organization },
  ] = await Promise.all([
    client
      .from("connectors")
      .select("id,name,type,status,dataset_id")
      .eq("process_id", processId)
      .order("created_at"),
    client
      .from("sync_runs")
      .select("*")
      .eq("process_id", processId)
      .order("started_at", { ascending: false })
      .limit(50),
    client
      .from("datasets")
      .select("id,name")
      .eq("process_id", processId)
      .eq("dataset_mode", "live"),
    client
      .from("organization_members")
      .select("role")
      .eq("organization_id", process.organization_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("organizations")
      .select("created_by")
      .eq("id", process.organization_id)
      .maybeSingle(),
  ]);
  if (error || historyError)
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Conectores indisponíveis</h1>
          <p>Não foi possível carregar o histórico. Tente novamente.</p>
        </section>
      </main>
    );
  const cards = await Promise.all(
    (connectors ?? []).map(async (connector) => {
      const [
        { count },
        { data: latestSuccess },
        { data: latestAttempt },
        { data: state },
      ] = await Promise.all([
        client
          .from("sync_runs")
          .select("id", { count: "exact", head: true })
          .eq("connector_id", connector.id),
        client
          .from("sync_runs")
          .select("completed_at")
          .eq("connector_id", connector.id)
          .in("status", ["succeeded", "partial"])
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("sync_runs")
          .select("started_at")
          .eq("connector_id", connector.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("connector_sync_state")
          .select("next_sync_at")
          .eq("connector_id", connector.id)
          .maybeSingle(),
      ]);
      return {
        ...connector,
        datasetName:
          (datasets ?? []).find(
            (dataset) => dataset.id === connector.dataset_id,
          )?.name ?? "Live Dataset",
        totalRuns: count ?? 0,
        nextSync: state?.next_sync_at ?? null,
        lastSync: latestAttempt?.started_at ?? null,
        lastSuccess: latestSuccess?.completed_at ?? null,
      };
    }),
  );
  return (
    <ConnectorCenter
      sheetsAvailable={sheetsReady()}
      googleNotice={
        ["connected", "failed"].includes(query.google ?? "")
          ? query.google
          : undefined
      }
      processId={processId}
      processName={process.name}
      connectors={cards}
      runs={(runs ?? []) as SyncRun[]}
      canManage={
        organization?.created_by === user.id ||
        ["owner", "admin"].includes(member?.role ?? "")
      }
    />
  );
}
