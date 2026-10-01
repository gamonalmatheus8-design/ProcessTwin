import { createDemoDataset, isDemoId } from "@/features/demo-center/datasets";
import { datasetCsv } from "@/features/demo-center/model";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scenario: string }> },
) {
  const { scenario } = await params;
  if (!isDemoId(scenario))
    return Response.json(
      { error: "Demonstração não encontrada." },
      { status: 404 },
    );
  return new Response(datasetCsv(createDemoDataset(scenario).records), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="synthetic-${scenario}.csv"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
