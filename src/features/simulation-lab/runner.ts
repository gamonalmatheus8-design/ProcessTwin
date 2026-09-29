import { simulateImprovement } from "@/core/process/simulation";
import type { SimulationResult, SimulationScenario } from "@/core/process/types";
import type {
  SimulationConfig,
  SimulationExecution,
  SimulationPayload,
  SimulationStore,
} from "./types";
import { validateProcessId, validateSimulationPayload } from "./validation";

const EXECUTION_ROLES = new Set(["owner", "admin", "analyst"]);

export class SimulationRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 500,
  ) {
    super(message);
    this.name = "SimulationRequestError";
  }
}

export function createSimulationConfig(payload: SimulationPayload): SimulationConfig {
  return {
    version: "v1",
    activityAdjustments: {
      [payload.activity]: {
        waitReductionPct: payload.waitReductionPct,
        capacityMultiplier: payload.capacityMultiplier,
      },
    },
    ...(payload.slaThresholdSeconds === undefined
      ? {}
      : { slaThresholdSeconds: payload.slaThresholdSeconds }),
    assumptions: {
      model: "proportional-observed-interval",
      queueing: false,
    },
  };
}

export async function runProcessSimulation({
  store,
  processId,
  userId,
  payload: rawPayload,
  simulate = simulateImprovement,
}: {
  store: SimulationStore;
  processId: string;
  userId: string;
  payload: unknown;
  simulate?: typeof simulateImprovement;
}): Promise<SimulationExecution> {
  const processIdResult = validateProcessId(processId);
  if (!processIdResult.ok) {
    throw new SimulationRequestError(processIdResult.error, 400);
  }

  const payloadResult = validateSimulationPayload(rawPayload);
  if (!payloadResult.ok) {
    throw new SimulationRequestError(payloadResult.error, 400);
  }

  const process = await store.getProcessAccess(processId, userId);
  if (!process) {
    throw new SimulationRequestError("Processo não encontrado.", 404);
  }

  const isOrganizationCreator = process.organizationCreatedBy === userId;
  if (!isOrganizationCreator && (!process.role || !EXECUTION_ROLES.has(process.role))) {
    throw new SimulationRequestError(
      "Seu perfil pode visualizar cenários, mas não executar uma nova simulação.",
      403,
    );
  }

  const analysis = await store.getLatestCompletedAnalysis(
    process.id,
    process.organizationId,
  );
  if (!analysis) {
    throw new SimulationRequestError("Não há análise concluída para este processo.", 404);
  }

  const model = await store.getProcessModel(
    analysis.id,
    process.id,
    process.organizationId,
  );
  if (!model) {
    throw new SimulationRequestError("O modelo da análise base não foi encontrado.", 404);
  }

  const activityValidation = validateSimulationPayload(
    payloadResult.value,
    model.nodes.map((node) => node.activity),
  );
  if (!activityValidation.ok) {
    throw new SimulationRequestError(activityValidation.error, 400);
  }
  const payload = activityValidation.value;

  const events = await store.getProcessEvents(
    analysis.datasetId,
    process.id,
    process.organizationId,
  );
  if (!events.length) {
    throw new SimulationRequestError("A análise base não possui eventos disponíveis.", 404);
  }

  const config = createSimulationConfig(payload);
  const scenario = await store.createScenario({
    organizationId: process.organizationId,
    processId: process.id,
    baselineAnalysisRunId: analysis.id,
    name: payload.name,
    description: payload.description ?? null,
    config,
    createdBy: userId,
  });

  const run = await store.createRun({
    organizationId: process.organizationId,
    processId: process.id,
    scenarioId: scenario.id,
    createdBy: userId,
  });

  try {
    const engineScenario: SimulationScenario = {
      name: payload.name,
      activityAdjustments: config.activityAdjustments,
      ...(payload.slaThresholdSeconds === undefined
        ? {}
        : { slaThresholdSeconds: payload.slaThresholdSeconds }),
    };
    const result: SimulationResult = simulate(events, engineScenario);

    await store.createResult({
      organizationId: process.organizationId,
      processId: process.id,
      simulationRunId: run.id,
      result,
    });
    await store.completeRun(run.id, process.organizationId);

    return {
      scenarioId: scenario.id,
      runId: run.id,
      createdAt: scenario.createdAt,
      payload,
      result,
    };
  } catch {
    try {
      await store.failRun(
        run.id,
        process.organizationId,
        "Não foi possível concluir a simulação.",
      );
    } catch {
      // Preserve the original execution failure; the adapter logs operational details.
    }
    throw new SimulationRequestError("Não foi possível concluir a simulação.", 500);
  }
}
