import type { SimulationResult } from "@/core/process/types";
import type { SimulationPayload } from "./types";

export const MODEL_NOTICE =
  "Esta simulação é uma estimativa baseada nos intervalos observados no event log. Ela ainda não modela filas, concorrência ou utilização real de recursos.";

export const AGGRESSIVE_NOTICE =
  "Cenário agressivo. Interprete o resultado como hipótese exploratória, não como previsão operacional.";

export function effectiveFactor(waitReductionPct: number, capacityMultiplier: number) {
  return (1 - waitReductionPct / 100) / capacityMultiplier;
}

export function isAggressiveScenario(
  waitReductionPct: number,
  capacityMultiplier: number,
) {
  return (
    waitReductionPct >= 70 ||
    capacityMultiplier >= 2.5 ||
    effectiveFactor(waitReductionPct, capacityMultiplier) <= 0.15
  );
}

export function formatDuration(seconds: number) {
  const roundedMinutes = Math.round(Math.max(0, seconds) / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

export function formatPercent(value: number, signed = false) {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatPercentagePoints(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)} p.p.`;
}

export function buildOpportunityCard(
  payload: Pick<
    SimulationPayload,
    "activity" | "waitReductionPct" | "capacityMultiplier"
  >,
  result: SimulationResult,
) {
  if (result.impactSummary.secondsSavedPerCase <= 0) {
    return "Este cenário não alterou significativamente os indicadores.";
  }

  const base = `Neste cenário, reduzir ${payload.waitReductionPct}% do atraso observado em ${payload.activity} e considerar capacidade relativa de ${payload.capacityMultiplier.toFixed(1)}x reduz o ciclo médio estimado de ${formatDuration(result.baseline.avgCycleSeconds)} para ${formatDuration(result.simulated.avgCycleSeconds)}. Isso representa ${formatDuration(result.impactSummary.secondsSavedPerCase)} economizadas por case e ${result.impactSummary.hoursSavedPer100Cases.toFixed(1)}h a cada 100 cases.`;

  return result.deltas.throughputGainPct > 0
    ? `${base} Ganho potencial de throughput: ${formatPercent(result.deltas.throughputGainPct)}.`
    : base;
}
