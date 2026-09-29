import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";
import type { ProcessModel } from "@/core/process/types";
import type { SimulationStore } from "./types";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function ensureNoError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

export function createSupabaseSimulationStore(
  supabase: ServerSupabaseClient,
): SimulationStore {
  return {
    async getProcessAccess(processId, userId) {
      const { data: process, error } = await supabase
        .from("processes")
        .select("id,organization_id,created_by")
        .eq("id", processId)
        .maybeSingle();
      ensureNoError(error, "load process");
      if (!process) return null;

      const [{ data: membership }, { data: organization }] = await Promise.all([
        supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", process.organization_id)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("created_by")
          .eq("id", process.organization_id)
          .maybeSingle(),
      ]);

      return {
        id: process.id,
        organizationId: process.organization_id,
        createdBy: process.created_by,
        role: membership?.role ?? null,
        organizationCreatedBy: organization?.created_by ?? null,
      };
    },

    async getLatestCompletedAnalysis(processId, organizationId) {
      const { data, error } = await supabase
        .from("analysis_runs")
        .select("id,dataset_id")
        .eq("process_id", processId)
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      ensureNoError(error, "load analysis");
      return data ? { id: data.id, datasetId: data.dataset_id } : null;
    },

    async getProcessModel(analysisRunId, processId, organizationId) {
      const { data, error } = await supabase
        .from("process_models")
        .select("graph,metrics,variants")
        .eq("analysis_run_id", analysisRunId)
        .eq("process_id", processId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      ensureNoError(error, "load process model");
      if (!data) return null;

      const graph = data.graph as unknown as Pick<ProcessModel, "nodes" | "edges">;
      return {
        nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
        edges: Array.isArray(graph.edges) ? graph.edges : [],
        variants: Array.isArray(data.variants) ? (data.variants as ProcessModel["variants"]) : [],
        metrics: data.metrics as unknown as ProcessModel["metrics"],
      };
    },

    async getProcessEvents(datasetId, processId, organizationId) {
      const pageSize = 1_000;
      const rows: Array<{
        case_id: string;
        activity: string;
        event_time: string;
        resource: string | null;
        event_index: number;
      }> = [];

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("process_events")
          .select("case_id,activity,event_time,resource,event_index")
          .eq("dataset_id", datasetId)
          .eq("process_id", processId)
          .eq("organization_id", organizationId)
          .order("event_index", { ascending: true })
          .range(from, from + pageSize - 1);
        ensureNoError(error, "load process events");
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }

      return rows.map((event) => ({
        caseId: event.case_id,
        activity: event.activity,
        timestamp: event.event_time,
        resource: event.resource,
      }));
    },

    async createScenario(input) {
      const { data, error } = await supabase
        .from("simulation_scenarios")
        .insert({
          organization_id: input.organizationId,
          process_id: input.processId,
          baseline_analysis_run_id: input.baselineAnalysisRunId,
          name: input.name,
          description: input.description,
          config: input.config as unknown as Json,
          created_by: input.createdBy,
        })
        .select("id,created_at")
        .single();
      ensureNoError(error, "create scenario");
      if (!data) throw new Error("create scenario returned no data");
      return { id: data.id, createdAt: data.created_at };
    },

    async createRun(input) {
      const { data, error } = await supabase
        .from("simulation_runs")
        .insert({
          organization_id: input.organizationId,
          process_id: input.processId,
          scenario_id: input.scenarioId,
          status: "running",
          iterations: 1,
          random_seed: null,
          started_at: new Date().toISOString(),
          created_by: input.createdBy,
        })
        .select("id")
        .single();
      ensureNoError(error, "create simulation run");
      if (!data) throw new Error("create simulation run returned no data");
      return { id: data.id };
    },

    async createResult(input) {
      const { error } = await supabase.from("simulation_results").insert({
        organization_id: input.organizationId,
        process_id: input.processId,
        simulation_run_id: input.simulationRunId,
        baseline_metrics: input.result.baseline as unknown as Json,
        simulated_metrics: input.result.simulated as unknown as Json,
        deltas: input.result.deltas as unknown as Json,
        impact_summary: input.result.impactSummary as unknown as Json,
      });
      ensureNoError(error, "create simulation result");
    },

    async completeRun(runId, organizationId) {
      const { error } = await supabase
        .from("simulation_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", runId)
        .eq("organization_id", organizationId);
      ensureNoError(error, "complete simulation run");
    },

    async failRun(runId, organizationId, message) {
      const { error } = await supabase
        .from("simulation_runs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .eq("organization_id", organizationId);
      ensureNoError(error, "fail simulation run");
    },
  };
}
