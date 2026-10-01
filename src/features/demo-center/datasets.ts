import type { ProcessEvent } from "@/core/process/types";

export const DEMO_NOTICE =
  "Dados sintéticos utilizados para fins demonstrativos.";
export type DemoId = "enrollment" | "tuition" | "tickets";
export type DemoRecord = ProcessEvent & {
  eventId: string;
  priority: string;
  category: string;
};
export type DemoDataset = {
  id: DemoId;
  sector: "school" | "company";
  organization: string;
  name: string;
  description: string;
  question: string;
  hypothesis: string;
  slaHours: number;
  caseLabel: string;
  records: DemoRecord[];
};

const definitions = {
  enrollment: {
    sector: "school",
    organization: "Instituto Nova Geração",
    name: "Matrículas",
    description: "Da inscrição à confirmação, com retornos de documentação.",
    question: "Em qual etapa as matrículas acumulam os maiores intervalos?",
    hypothesis:
      "Padronizar a conferência documental e antecipar a revisão dos documentos.",
    slaHours: 72,
    caseLabel: "matrículas",
    activities: [
      "Inscrição",
      "Documentação",
      "Conferência",
      "Análise",
      "Contrato",
      "Pagamento inicial",
      "Matrícula confirmada",
    ],
    intervals: [0, 4, 28, 5, 3, 8, 1],
    target: "Conferência",
    teams: ["Secretaria A", "Secretaria B", "Secretaria C"],
  },
  tuition: {
    sector: "school",
    organization: "Instituto Nova Geração",
    name: "Mensalidades",
    description: "Da geração à baixa, com divergências na conciliação.",
    question: "O que acontece entre o pagamento identificado e a baixa?",
    hypothesis:
      "Padronizar a identificação dos pagamentos e a conferência da conciliação.",
    slaHours: 120,
    caseLabel: "mensalidades",
    activities: [
      "Mensalidade gerada",
      "Notificação",
      "Aguardando pagamento",
      "Pagamento identificado",
      "Conciliação",
      "Baixa",
    ],
    intervals: [0, 1, 1, 24, 36, 2],
    target: "Conciliação",
    teams: ["Financeiro A", "Financeiro B", "Financeiro C"],
  },
  tickets: {
    sector: "company",
    organization: "NexaTech Solutions",
    name: "Chamados empresariais",
    description: "Do chamado à resolução, com prioridades e reaberturas.",
    question:
      "Quais caminhos incluem reabertura e concentram os maiores intervalos?",
    hypothesis:
      "Melhorar a triagem e os critérios de validação antes de encerrar o chamado.",
    slaHours: 48,
    caseLabel: "chamados",
    activities: [
      "Chamado aberto",
      "Triagem",
      "Classificação",
      "Em análise",
      "Correção",
      "Validação",
      "Resolvido",
    ],
    intervals: [0, 1, 1, 4, 20, 3, 1],
    target: "Correção",
    teams: ["Equipe Aplicações", "Equipe Infraestrutura", "Equipe Suporte"],
  },
} as const;

export function isDemoId(value: string): value is DemoId {
  return Object.hasOwn(definitions, value);
}
export const demoIds: DemoId[] = ["enrollment", "tuition", "tickets"];

// Fixed dates and deterministic variation make every export reproducible.
// Organizations, identifiers, teams, priorities and categories are all fictitious.
export function createDemoDataset(id: DemoId): DemoDataset {
  const definition = definitions[id];
  const records: DemoRecord[] = [];
  for (let i = 0; i < 36; i++) {
    const caseId = `${id.toUpperCase()}-${String(i + 1).padStart(3, "0")}`;
    const resource = definition.teams[i % 3];
    const priority = ["Alta", "Normal", "Baixa"][Math.floor(i / 3) % 3];
    const category =
      id === "tickets"
        ? ["Acesso", "Sistema", "Rede"][Math.floor(i / 9) % 3]
        : id === "tuition"
          ? "Administrativo"
          : "Ingresso";
    let clock = Date.UTC(2026, 8, 1, 8) + i * 5 * 3_600_000;
    let index = 0;
    const append = (activity: string, hours: number) => {
      clock += hours * 3_600_000;
      records.push({
        eventId: `${caseId}-E${String(++index).padStart(2, "0")}`,
        caseId,
        activity,
        timestamp: new Date(clock).toISOString(),
        resource,
        priority,
        category,
      });
    };
    definition.activities.forEach((activity, step) => {
      const hours =
        definition.intervals[step] *
        (activity === definition.target
          ? 1 + (i % 3) * 0.35 + (Math.floor(i / 3) % 4) * 0.1
          : 1);
      append(activity, hours);
      if (activity === definition.target && i % 4 === 0 && id !== "tickets") {
        append(
          id === "enrollment" ? "Documentação" : "Pagamento identificado",
          5,
        );
        append(activity, hours * 0.45);
      }
      if (activity === "Resolvido" && i % 4 === 0) {
        append("Reaberto", 8);
        append("Em análise", 3);
        append("Correção", 12 + (i % 3) * 6);
        append("Validação", 2);
        append("Resolvido", 1);
      }
    });
  }
  return {
    id,
    sector: definition.sector,
    organization: definition.organization,
    name: definition.name,
    description: definition.description,
    question: definition.question,
    hypothesis: definition.hypothesis,
    slaHours: definition.slaHours,
    caseLabel: definition.caseLabel,
    records,
  };
}

export const demoSteps = [
  "Dados",
  "Processo",
  "Gargalo",
  "Simulação",
  "Impacto",
] as const;
export const stepIds = [
  "data",
  "process",
  "bottleneck",
  "simulation",
  "impact",
] as const;
export function demoStep(value: string | undefined) {
  const index = stepIds.findIndex((step) => step === value);
  return index < 0 ? 0 : index;
}
