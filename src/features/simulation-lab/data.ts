import "server-only";

import type {
  Bottleneck,
  ProcessModel,
  SimulationResult,
} from "@/core/process/types";
import { createClient } from "@/lib/supabase/server";
import type {
  SimulationConfig,
  SimulationHistoryItem,
  SimulationLabLoadResult,
} from "./types";

const EXECUTION_ROLES = new Set(["owner", "admin", "analyst"]);

function readConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Partial<SimulationConfig>;
  if (!config.activityAdjustments || typeof config.activityAdjustments !== "object") {
    return null;
  }
  const entry = Object.entries(config.activityAdjustments)[0];
  if (!entry) return null;
  const [activity, adjustment] = entry;
  if (
    !adjustment ||
    typeof adjustment.waitReductionPct !== "number" ||
    typeof adjustment.capacityMultiplier !== "number"
  ) {
    return null;
  }
  return {
    activity,
    waitReductionPct: adjustment.waitReductionPct,
    capacityMultiplier: adjustment.capacityMultiplier,
    slaThresholdSeconds:
      typeof config.slaThresholdSeconds === "number"
        ? config.slaThresholdSeconds
        : undefined,
  };
}

export async function getSimulationLabData(
  processId: string,
  requestedActivity?: string,
): Promise<SimulationLabLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { kind: "not-found" };

  const { data: process, error: processError } = await supabase
    .from("processes")
    .select("id,name,status,organization_id")
    .eq("id", processId)
    .maybeSingle();
  if (processError || !process) return { kind: "not-found" };

  const processInfo = { id: process.id, name: process.name, status: process.status };
  const { data: analysis, error: analysisError } = await supabase
    .from("analysis_runs")
    .select("id,dataset_id,created_at,completed_at")
    .eq("process_id", processId)
    .eq("organization_id", process.organization_id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysisError) return { kind: "error", process: processInfo };
  if (!analysis) return { kind: "no-analysis", process: processInfo };

  const [modelResponse, datasetResponse, bottleneckResponse, membershipResponse, organizationResponse] =
    await Promise.all([
      supabase
        .from("process_models")
        .select("graph,metrics,variants")
        .eq("analysis_run_id", analysis.id)
        .eq("process_id", processId)
        .eq("organization_id", process.organization_id)
        .maybeSingle(),
      supabase
        .from("datasets")
        .select("id,name,original_filename")
        .eq("id", analysis.dataset_id)
        .eq("process_id", processId)
        .eq("organization_id", process.organization_id)
        .maybeSingle(),
      supabase
        .from("bottlenecks")
        .select("activity,score,severity,avg_wait_seconds,affected_cases,rework_rate_pct,evidence")
        .eq("analysis_run_id", analysis.id)
        .eq("organization_id", process.organization_id)
        .order("rank", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", process.organization_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("created_by")
        .eq("id", process.organization_id)
        .maybeSingle(),
    ]);

  if (
    modelResponse.error ||
    datasetResponse.error ||
    bottleneckResponse.error ||
    !modelResponse.data ||
    !datasetResponse.data
  ) {
    return { kind: "error", process: processInfo };
  }

  const graph = modelResponse.data.graph as unknown as Pick<ProcessModel, "nodes" | "edges">;
  const activities = Array.isArray(graph.nodes) ? graph.nodes : [];
  const bottleneckRow = bottleneckResponse.data;
  const primaryBottleneck: Bottleneck | null = bottleneckRow
    ? {
        activity: bottleneckRow.activity,
        score: Number(bottleneckRow.score),
        severity: bottleneckRow.severity as Bottleneck["severity"],
        avgWaitSeconds: Number(bottleneckRow.avg_wait_seconds ?? 0),
        affectedCases: Number(bottleneckRow.affected_cases ?? 0),
        reworkRatePct: Number(bottleneckRow.rework_rate_pct ?? 0),
        evidence: bottleneckRow.evidence as unknown as Bottleneck["evidence"],
      }
    : null;
  const initialActivity =
    activities.find((node) => node.activity === requestedActivity)?.activity ??
    activities.find((node) => node.activity === primaryBottleneck?.activity)?.activity ??
    activities[0]?.activity ??
    "";

  const { data: scenarioRows, error: scenarioError } = await supabase
    .from("simulation_scenarios")
    .select("id,name,description,created_at,config")
    .eq("process_id", processId)
    .eq("organization_id", process.organization_id)
    .eq("baseline_analysis_run_id", analysis.id)
    .order("created_at", { ascending: false })
    .limit(10);

  let history: SimulationHistoryItem[] = [];
  if (!scenarioError && scenarioRows?.length) {
    const { data: runRows } = await supabase
      .from("simulation_runs")
      .select("id,scenario_id,created_at")
      .eq("organization_id", process.organization_id)
      .eq("process_id", processId)
      .eq("status", "completed")
      .in("scenario_id", scenarioRows.map((scenario) => scenario.id))
      .order("created_at", { ascending: false });
    const latestRunByScenario = new Map<string, { id: string }>();
    for (const run of runRows ?? []) {
      if (!latestRunByScenario.has(run.scenario_id)) {
        latestRunByScenario.set(run.scenario_id, { id: run.id });
      }
    }
    const runIds = [...latestRunByScenario.values()].map((run) => run.id);
    const { data: resultRows } = runIds.length
      ? await supabase
          .from("simulation_results")
          .select("simulation_run_id,baseline_metrics,simulated_metrics,deltas,impact_summary")
          .eq("organization_id", process.organization_id)
          .in("simulation_run_id", runIds)
      : { data: [] };
    const resultByRun = new Map(
      (resultRows ?? []).map((result) => [result.simulation_run_id, result]),
    );

    history = scenarioRows.flatMap((scenario): SimulationHistoryItem[] => {
      const config = readConfig(scenario.config);
      const run = latestRunByScenario.get(scenario.id);
      const stored = run ? resultByRun.get(run.id) : undefined;
      if (!config || !run || !stored) return [];
      const impact = stored.impact_summary as unknown as SimulationResult["impactSummary"];
      const result: SimulationResult = {
        scenarioName: scenario.name,
        baseline: stored.baseline_metrics as unknown as SimulationResult["baseline"],
        simulated: stored.simulated_metrics as unknown as SimulationResult["simulated"],
        deltas: stored.deltas as unknown as SimulationResult["deltas"],
        impactSummary: {
          ...impact,
          slaThresholdSeconds:
            Number(impact.slaThresholdSeconds) || config.slaThresholdSeconds || 0,
        },
      };
      return [
        {
          scenarioId: scenario.id,
          runId: run.id,
          name: scenario.name,
          description: scenario.description,
          createdAt: scenario.created_at,
          ...config,
          result,
        },
      ];
    });
  }

  const role = membershipResponse.data?.role ?? null;
  return {
    kind: "ok",
    data: {
      process: processInfo,
      dataset: {
        id: datasetResponse.data.id,
        name: datasetResponse.data.name,
        originalFilename: datasetResponse.data.original_filename,
      },
      analysis: {
        id: analysis.id,
        createdAt: analysis.created_at,
        completedAt: analysis.completed_at,
      },
      activities,
      primaryBottleneck,
      initialActivity,
      canRun:
        organizationResponse.data?.created_by === user.id ||
        (role !== null && EXECUTION_ROLES.has(role)),
      history,
    },
  };
}
