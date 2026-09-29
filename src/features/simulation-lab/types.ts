import type {
  Bottleneck,
  ProcessEvent,
  ProcessModel,
  ProcessNode,
  SimulationResult,
} from "@/core/process/types";

export type SimulationPayload = {
  name: string;
  description?: string;
  activity: string;
  waitReductionPct: number;
  capacityMultiplier: number;
  slaThresholdSeconds?: number;
};

export type SimulationConfig = {
  version: "v1";
  activityAdjustments: Record<
    string,
    { waitReductionPct: number; capacityMultiplier: number }
  >;
  slaThresholdSeconds?: number;
  assumptions: {
    model: "proportional-observed-interval";
    queueing: false;
  };
};

export type SimulationHistoryItem = {
  scenarioId: string;
  runId: string;
  name: string;
  description: string | null;
  createdAt: string;
  activity: string;
  waitReductionPct: number;
  capacityMultiplier: number;
  slaThresholdSeconds?: number;
  result: SimulationResult;
};

export type SimulationLabData = {
  process: { id: string; name: string; status: string };
  dataset: { id: string; name: string; originalFilename: string | null };
  analysis: { id: string; createdAt: string; completedAt: string | null };
  activities: ProcessNode[];
  primaryBottleneck: Bottleneck | null;
  initialActivity: string;
  canRun: boolean;
  history: SimulationHistoryItem[];
};

export type SimulationLabLoadResult =
  | { kind: "ok"; data: SimulationLabData }
  | { kind: "no-analysis"; process: SimulationLabData["process"] }
  | { kind: "error"; process: SimulationLabData["process"] }
  | { kind: "not-found" };

export type ProcessAccess = {
  id: string;
  organizationId: string;
  createdBy: string;
  role: string | null;
  organizationCreatedBy: string | null;
};

export type CompletedAnalysis = {
  id: string;
  datasetId: string;
};

export interface SimulationStore {
  getProcessAccess(processId: string, userId: string): Promise<ProcessAccess | null>;
  getLatestCompletedAnalysis(
    processId: string,
    organizationId: string,
  ): Promise<CompletedAnalysis | null>;
  getProcessModel(
    analysisRunId: string,
    processId: string,
    organizationId: string,
  ): Promise<ProcessModel | null>;
  getProcessEvents(
    datasetId: string,
    processId: string,
    organizationId: string,
  ): Promise<ProcessEvent[]>;
  createScenario(input: {
    organizationId: string;
    processId: string;
    baselineAnalysisRunId: string;
    name: string;
    description: string | null;
    config: SimulationConfig;
    createdBy: string;
  }): Promise<{ id: string; createdAt: string }>;
  createRun(input: {
    organizationId: string;
    processId: string;
    scenarioId: string;
    createdBy: string;
  }): Promise<{ id: string }>;
  createResult(input: {
    organizationId: string;
    processId: string;
    simulationRunId: string;
    result: SimulationResult;
  }): Promise<void>;
  completeRun(runId: string, organizationId: string): Promise<void>;
  failRun(runId: string, organizationId: string, message: string): Promise<void>;
}

export type SimulationExecution = {
  scenarioId: string;
  runId: string;
  createdAt: string;
  payload: SimulationPayload;
  result: SimulationResult;
};
