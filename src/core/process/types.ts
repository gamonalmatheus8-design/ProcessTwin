export type ProcessEvent = {
  caseId: string;
  activity: string;
  timestamp: string;
  resource?: string | null;
};

export type ProcessNode = {
  activity: string;
  eventCount: number;
  caseCount: number;
  reworkCount: number;
  avgIncomingWaitSeconds: number;
};

export type ProcessEdge = {
  source: string;
  target: string;
  count: number;
  avgWaitSeconds: number;
};

export type ProcessVariant = {
  path: string[];
  caseCount: number;
};

export type ProcessMetrics = {
  caseCount: number;
  eventCount: number;
  avgCycleSeconds: number;
  p95CycleSeconds: number;
  reworkRatePct: number;
};

export type ProcessModel = {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  variants: ProcessVariant[];
  metrics: ProcessMetrics;
};

export type Bottleneck = {
  activity: string;
  score: number;
  severity: "low" | "medium" | "high" | "critical";
  avgWaitSeconds: number;
  affectedCases: number;
  reworkRatePct: number;
  evidence: {
    waitWeight: number;
    volumeWeight: number;
    reworkWeight: number;
  };
};

export type ActivityAdjustment = {
  waitReductionPct?: number;
  capacityMultiplier?: number;
};

export type SimulationScenario = {
  name: string;
  activityAdjustments: Record<string, ActivityAdjustment>;
  slaThresholdSeconds?: number;
};

export type SimulationMetrics = {
  avgCycleSeconds: number;
  p95CycleSeconds: number;
  slaCompliancePct: number;
};

export type SimulationResult = {
  scenarioName: string;
  baseline: SimulationMetrics;
  simulated: SimulationMetrics;
  deltas: {
    avgCyclePct: number;
    p95CyclePct: number;
    slaPercentagePoints: number;
    throughputGainPct: number;
  };
  impactSummary: {
    secondsSavedPerCase: number;
    hoursSavedPer100Cases: number;
    slaThresholdSeconds: number;
  };
};

export type CoreCycleResult = {
  model: ProcessModel;
  metrics: ProcessMetrics;
  bottleneck: Bottleneck | null;
  simulation: SimulationResult;
  impact: SimulationResult["impactSummary"];
};
