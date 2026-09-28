import type { ProcessEvent, SimulationScenario } from "@/core/process/types";

const day = "2026-09-15";
const e = (
  caseId: string,
  activity: string,
  time: string,
  resource?: string,
): ProcessEvent => ({
  caseId,
  activity,
  timestamp: `${day}T${time}:00-03:00`,
  resource,
});

export const demoEvents: ProcessEvent[] = [
  e("PED-001", "Pedido recebido", "08:00", "Portal"),
  e("PED-001", "Triagem", "08:10", "Ana"),
  e("PED-001", "Análise", "08:35", "Bruno"),
  e("PED-001", "Aprovação", "13:40", "Carlos"),
  e("PED-001", "Expedição", "14:20", "Equipe A"),

  e("PED-002", "Pedido recebido", "08:05", "Portal"),
  e("PED-002", "Triagem", "08:14", "Ana"),
  e("PED-002", "Análise", "08:42", "Bruno"),
  e("PED-002", "Aprovação", "14:10", "Carlos"),
  e("PED-002", "Expedição", "14:45", "Equipe A"),

  e("PED-003", "Pedido recebido", "08:20", "Portal"),
  e("PED-003", "Triagem", "08:30", "Ana"),
  e("PED-003", "Análise", "09:05", "Bruno"),
  e("PED-003", "Aprovação", "15:30", "Carlos"),
  e("PED-003", "Expedição", "16:05", "Equipe B"),

  e("PED-004", "Pedido recebido", "08:35", "Portal"),
  e("PED-004", "Triagem", "08:50", "Ana"),
  e("PED-004", "Análise", "09:20", "Bruno"),
  e("PED-004", "Aprovação", "12:55", "Carlos"),
  e("PED-004", "Expedição", "13:40", "Equipe B"),

  e("PED-005", "Pedido recebido", "09:00", "Portal"),
  e("PED-005", "Triagem", "09:12", "Ana"),
  e("PED-005", "Análise", "09:44", "Bruno"),
  e("PED-005", "Aprovação", "16:10", "Carlos"),
  e("PED-005", "Expedição", "16:55", "Equipe A"),

  e("PED-006", "Pedido recebido", "09:15", "Portal"),
  e("PED-006", "Triagem", "09:25", "Ana"),
  e("PED-006", "Análise", "10:00", "Bruno"),
  e("PED-006", "Aprovação", "15:20", "Carlos"),
  e("PED-006", "Análise", "15:40", "Bruno"),
  e("PED-006", "Aprovação", "17:10", "Carlos"),
  e("PED-006", "Expedição", "17:45", "Equipe B"),

  e("PED-007", "Pedido recebido", "09:30", "Portal"),
  e("PED-007", "Triagem", "09:40", "Ana"),
  e("PED-007", "Análise", "10:05", "Bruno"),
  e("PED-007", "Aprovação", "14:35", "Carlos"),
  e("PED-007", "Expedição", "15:15", "Equipe A"),

  e("PED-008", "Pedido recebido", "10:00", "Portal"),
  e("PED-008", "Triagem", "10:12", "Ana"),
  e("PED-008", "Análise", "10:40", "Bruno"),
  e("PED-008", "Aprovação", "16:50", "Carlos"),
  e("PED-008", "Expedição", "17:30", "Equipe B"),

  e("PED-009", "Pedido recebido", "10:20", "Portal"),
  e("PED-009", "Triagem", "10:30", "Ana"),
  e("PED-009", "Análise", "11:00", "Bruno"),
  e("PED-009", "Aprovação", "15:45", "Carlos"),
  e("PED-009", "Expedição", "16:20", "Equipe A"),

  e("PED-010", "Pedido recebido", "10:40", "Portal"),
  e("PED-010", "Triagem", "10:55", "Ana"),
  e("PED-010", "Análise", "11:25", "Bruno"),
  e("PED-010", "Aprovação", "17:30", "Carlos"),
  e("PED-010", "Expedição", "18:00", "Equipe B"),
];

export const demoScenario: SimulationScenario = {
  name: "Aumentar capacidade da aprovação",
  activityAdjustments: {
    Aprovação: {
      waitReductionPct: 35,
      capacityMultiplier: 1.5,
    },
  },
};
