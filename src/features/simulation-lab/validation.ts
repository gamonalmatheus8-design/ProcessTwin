import type { SimulationPayload } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_SLA_SECONDS = 365 * 24 * 60 * 60;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateProcessId(processId: unknown): ValidationResult<string> {
  if (typeof processId !== "string" || !UUID_PATTERN.test(processId)) {
    return { ok: false, error: "processId deve ser um UUID válido." };
  }
  return { ok: true, value: processId };
}

export function validateSimulationPayload(
  input: unknown,
  activities?: readonly string[],
): ValidationResult<SimulationPayload> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Payload de simulação inválido." };
  }

  const value = input as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const activity = typeof value.activity === "string" ? value.activity.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : undefined;

  if (!name) return { ok: false, error: "Informe um nome para o cenário." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.` };
  }
  if (value.description !== undefined && typeof value.description !== "string") {
    return { ok: false, error: "A descrição deve ser um texto." };
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    };
  }
  if (!activity) return { ok: false, error: "Selecione uma atividade." };
  if (activities && !activities.includes(activity)) {
    return { ok: false, error: "A atividade não pertence ao modelo do processo." };
  }

  if (
    typeof value.waitReductionPct !== "number" ||
    !Number.isFinite(value.waitReductionPct) ||
    value.waitReductionPct < 0 ||
    value.waitReductionPct > 80
  ) {
    return { ok: false, error: "A redução estimada deve ser um número entre 0 e 80." };
  }

  if (
    typeof value.capacityMultiplier !== "number" ||
    !Number.isFinite(value.capacityMultiplier) ||
    value.capacityMultiplier < 1 ||
    value.capacityMultiplier > 3
  ) {
    return { ok: false, error: "A capacidade relativa deve ser um número entre 1 e 3." };
  }

  if (
    value.slaThresholdSeconds !== undefined &&
    (typeof value.slaThresholdSeconds !== "number" ||
      !Number.isFinite(value.slaThresholdSeconds) ||
      value.slaThresholdSeconds <= 0 ||
      value.slaThresholdSeconds > MAX_SLA_SECONDS)
  ) {
    return { ok: false, error: "O SLA deve ser um número positivo dentro do limite permitido." };
  }

  return {
    ok: true,
    value: {
      name,
      description: description || undefined,
      activity,
      waitReductionPct: value.waitReductionPct,
      capacityMultiplier: value.capacityMultiplier,
      ...(value.slaThresholdSeconds === undefined
        ? {}
        : { slaThresholdSeconds: value.slaThresholdSeconds }),
    },
  };
}
