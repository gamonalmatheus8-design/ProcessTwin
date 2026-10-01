import { notFound } from "next/navigation";
import { ConnectorCenter } from "@/features/sync/components/connector-center";
export const dynamic = "force-dynamic";
export default function SheetsFixture() {
  if (process.env.E2E_FIXTURES !== "true" || process.env.VERCEL) notFound();
  return (
    <ConnectorCenter
      processId="11111111-1111-4111-8111-111111111111"
      processName="Fixture sintética de testes"
      canManage
      sheetsAvailable
      connectors={[
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Planilha de matrículas",
          type: "google_sheets",
          status: "needs_attention",
          dataset_id: "dataset",
          datasetName: "Dataset sintético",
          totalRuns: 1,
          lastSync: "2026-09-30T03:00:00Z",
          lastSuccess: null,
          nextSync: null,
        },
      ]}
      runs={[
        {
          id: "33333333-3333-4333-8333-333333333333",
          connector_id: "22222222-2222-4222-8222-222222222222",
          dataset_id: "dataset",
          status: "failed",
          trigger: "scheduled",
          started_at: "2026-09-30T03:00:00Z",
          completed_at: "2026-09-30T03:00:05Z",
          filename: "google-sheets.csv",
          fetched_count: 0,
          accepted_count: 0,
          updated_count: 0,
          duplicate_count: 0,
          invalid_count: 0,
          analysis_status: "skipped",
          analysis_run_id: null,
          error_message:
            "A planilha mudou. Revise e confirme o mapeamento para continuar.",
        },
      ]}
    />
  );
}
