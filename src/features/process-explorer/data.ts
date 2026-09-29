import type {
  Bottleneck,
  ProcessEdge,
  ProcessMetrics,
  ProcessNode,
  ProcessVariant,
} from "@/core/process/types";
import { createClient } from "@/lib/supabase/server";
import type { ProcessExplorerLoadResult } from "./types";

export async function getLatestProcessExplorerData(
  processId: string,
): Promise<ProcessExplorerLoadResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { kind: "not-found" };

  const { data: process, error: processError } = await supabase
    .from("processes")
    .select("id,name,status")
    .eq("id", processId)
    .maybeSingle();

  if (processError || !process) return { kind: "not-found" };

  const { data: analysis, error: analysisError } = await supabase
    .from("analysis_runs")
    .select("id,dataset_id,created_at,completed_at")
    .eq("process_id", processId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysisError || !analysis) {
    return {
      kind: "no-analysis",
      process: {
        id: process.id,
        name: process.name,
        status: process.status,
      },
    };
  }

  const [{ data: model, error: modelError }, { data: dataset, error: datasetError }, { data: bottleneckRows, error: bottleneckError }] =
    await Promise.all([
      supabase
        .from("process_models")
        .select("graph,metrics,variants")
        .eq("analysis_run_id", analysis.id)
        .maybeSingle(),
      supabase
        .from("datasets")
        .select("id,name,original_filename,created_at")
        .eq("id", analysis.dataset_id)
        .maybeSingle(),
      supabase
        .from("bottlenecks")
        .select(
          "activity,score,severity,avg_wait_seconds,affected_cases,rework_rate_pct,evidence,rank",
        )
        .eq("analysis_run_id", analysis.id)
        .order("rank", { ascending: true }),
    ]);

  if (modelError || datasetError || bottleneckError || !model || !dataset) {
    return {
      kind: "no-analysis",
      process: {
        id: process.id,
        name: process.name,
        status: process.status,
      },
    };
  }

  const graph = model.graph as unknown as {
    nodes?: ProcessNode[];
    edges?: ProcessEdge[];
  };

  const metrics = model.metrics as unknown as ProcessMetrics;
  const variants = model.variants as unknown as ProcessVariant[];

  const bottlenecks: Bottleneck[] = (bottleneckRows ?? []).map((row) => ({
    activity: row.activity,
    score: Number(row.score),
    severity: row.severity as Bottleneck["severity"],
    avgWaitSeconds: Number(row.avg_wait_seconds ?? 0),
    affectedCases: Number(row.affected_cases ?? 0),
    reworkRatePct: Number(row.rework_rate_pct ?? 0),
    evidence: row.evidence as unknown as Bottleneck["evidence"],
  }));

  return {
    kind: "ok",
    data: {
      process: {
        id: process.id,
        name: process.name,
        status: process.status,
      },
      dataset: {
        id: dataset.id,
        name: dataset.name,
        originalFilename: dataset.original_filename,
        createdAt: dataset.created_at,
      },
      analysis: {
        id: analysis.id,
        createdAt: analysis.created_at,
        completedAt: analysis.completed_at,
      },
      model: {
        nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
        edges: Array.isArray(graph.edges) ? graph.edges : [],
        variants: Array.isArray(variants) ? variants : [],
        metrics,
      },
      bottlenecks,
    },
  };
}
