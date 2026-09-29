import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProcessModel } from "@/core/process/mining";
import { simulateImprovement } from "@/core/process/simulation";
import { demoEvents } from "@/data/demo-process";
import type { SimulationStore } from "./types";
import { runProcessSimulation, SimulationRequestError } from "./runner";

const processId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const payload = {
  name: "Melhorar aprovação",
  description: "Teste",
  activity: "Aprovação",
  waitReductionPct: 30,
  capacityMultiplier: 1.5,
};

function createStore(overrides: Partial<SimulationStore> = {}) {
  const store = {
    getProcessAccess: vi.fn(async () => ({
      id: processId,
      organizationId,
      createdBy: userId,
      role: "analyst",
      organizationCreatedBy: "another-user",
    })),
    getLatestCompletedAnalysis: vi.fn(async () => ({ id: "analysis-1", datasetId: "dataset-1" })),
    getProcessModel: vi.fn(async () => buildProcessModel(demoEvents)),
    getProcessEvents: vi.fn(async () => demoEvents),
    createScenario: vi.fn(async () => ({ id: "scenario-1", createdAt: "2026-09-29T12:00:00Z" })),
    createRun: vi.fn(async () => ({ id: "run-1" })),
    createResult: vi.fn(async () => undefined),
    completeRun: vi.fn(async () => undefined),
    failRun: vi.fn(async () => undefined),
    ...overrides,
  } as SimulationStore;
  return store;
}

describe("runProcessSimulation persistence", () => {
  let store: SimulationStore;

  beforeEach(() => {
    store = createStore();
  });

  it("uses simulateImprovement and persists scenario, result and completed run", async () => {
    const simulate = vi.fn(simulateImprovement);
    const execution = await runProcessSimulation({ store, processId, userId, payload, simulate });

    expect(simulate).toHaveBeenCalledOnce();
    expect(store.createScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        baselineAnalysisRunId: "analysis-1",
        processId,
      }),
    );
    expect(store.createResult).toHaveBeenCalledWith(
      expect.objectContaining({ simulationRunId: "run-1", result: execution.result }),
    );
    expect(store.completeRun).toHaveBeenCalledWith("run-1", organizationId);
    expect(store.failRun).not.toHaveBeenCalled();
  });

  it("marks the run failed with a safe message when execution fails", async () => {
    const simulate = vi.fn(() => {
      throw new Error("sensitive stack detail");
    });

    await expect(
      runProcessSimulation({ store, processId, userId, payload, simulate }),
    ).rejects.toMatchObject({
      status: 500,
      message: "Não foi possível concluir a simulação.",
    });
    expect(store.failRun).toHaveBeenCalledWith(
      "run-1",
      organizationId,
      "Não foi possível concluir a simulação.",
    );
  });

  it("blocks viewers before creating a scenario", async () => {
    store = createStore({
      getProcessAccess: vi.fn(async () => ({
        id: processId,
        organizationId,
        createdBy: "another-user",
        role: "viewer",
        organizationCreatedBy: "another-user",
      })),
    });

    await expect(
      runProcessSimulation({ store, processId, userId, payload }),
    ).rejects.toBeInstanceOf(SimulationRequestError);
    expect(store.createScenario).not.toHaveBeenCalled();
  });

  it("does not reveal a process hidden by tenant isolation", async () => {
    store = createStore({ getProcessAccess: vi.fn(async () => null) });

    await expect(
      runProcessSimulation({ store, processId, userId, payload }),
    ).rejects.toMatchObject({ status: 404, message: "Processo não encontrado." });
    expect(store.getLatestCompletedAnalysis).not.toHaveBeenCalled();
  });

  it("passes the authorized tenant to every persisted record", async () => {
    await runProcessSimulation({ store, processId, userId, payload });

    expect(store.createScenario).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId }),
    );
    expect(store.createRun).toHaveBeenCalledWith(expect.objectContaining({ organizationId }));
    expect(store.createResult).toHaveBeenCalledWith(expect.objectContaining({ organizationId }));
  });

  it("validates activity against the baseline model", async () => {
    await expect(
      runProcessSimulation({
        store,
        processId,
        userId,
        payload: { ...payload, activity: "Atividade de outro tenant" },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(store.getProcessEvents).not.toHaveBeenCalled();
    expect(store.createScenario).not.toHaveBeenCalled();
  });
});
