import type { CanonicalField } from "./types";

export type ProcessPackId =
  | "production"
  | "orders"
  | "deliveries"
  | "tickets"
  | "enrollment"
  | "hiring"
  | "approvals"
  | "ecommerce"
  | "generic";

export type ProcessPack = {
  id: ProcessPackId;
  label: string;
  description: string;
  exampleProcessName: string;
  keywords: string[];
  aliases: Record<CanonicalField, string[]>;
  examples: string[];
  metadataSuggestions: string[];
  kpiHints: string[];
};

const pack = (value: ProcessPack) => value;

export const PROCESS_PACKS: ProcessPack[] = [
  pack({
    id: "production",
    label: "Produção",
    description: "Descubra gargalos entre ordens, operações e etapas de fabricação.",
    exampleProcessName: "Processo de Produção",
    keywords: ["produção", "ordem", "operação", "lote", "fabricação"],
    aliases: {
      caseId: ["ordem_producao", "ordem", "op", "lote", "batch", "work_order", "production_order", "numero_ordem"],
      activity: ["etapa", "operacao", "operação", "fase", "posto", "status", "atividade", "process_step", "etapa_producao"],
      timestamp: ["data_hora", "timestamp", "inicio", "data_evento", "event_time", "created_at", "hora", "data_operacao", "inicio_operacao", "fim_operacao"],
      resource: ["operador", "maquina", "máquina", "linha", "setor", "responsavel", "responsável", "centro_trabalho"],
    },
    examples: ["Ordem à conclusão", "Lote por operação"],
    metadataSuggestions: ["quantidade", "produto", "turno"],
    kpiHints: ["lead time", "retrabalho", "intervalo observado"],
  }),
  pack({
    id: "orders",
    label: "Pedidos",
    description: "Analise o fluxo entre recebimento, processamento, aprovação e conclusão de pedidos.",
    exampleProcessName: "Processo de Pedidos",
    keywords: ["pedido", "venda", "cliente", "order"],
    aliases: {
      caseId: ["pedido", "pedido_id", "numero_pedido", "order_id", "order_number", "id_pedido"],
      activity: ["etapa", "status", "evento", "atividade", "stage", "event", "etapa_pedido", "status_pedido", "evento_pedido"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "data_pedido", "data_status", "movimentado_em"],
      resource: ["responsavel", "responsável", "usuario", "usuário", "atendente", "operador", "vendedor", "equipe"],
    },
    examples: ["Pedido ao pagamento", "Pedido ao faturamento"],
    metadataSuggestions: ["cliente", "valor", "canal"],
    kpiHints: ["tempo de ciclo", "retrabalho", "atrasos"],
  }),
  pack({
    id: "deliveries",
    label: "Entregas",
    description: "Entenda onde entregas ficam paradas e quais etapas aumentam o lead time.",
    exampleProcessName: "Processo de Entregas",
    keywords: ["entrega", "remessa", "rastreamento", "shipment", "delivery"],
    aliases: {
      caseId: ["entrega_id", "shipment_id", "tracking_id", "codigo_rastreio", "pedido", "delivery_id", "remessa"],
      activity: ["status", "etapa", "evento", "checkpoint", "delivery_status", "status_entrega", "ocorrencia"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "data_ocorrencia", "atualizado_em", "data_entrega"],
      resource: ["motorista", "transportadora", "unidade", "hub", "responsavel", "responsável", "carrier"],
    },
    examples: ["Coleta à entrega", "Remessa por checkpoint"],
    metadataSuggestions: ["rota", "cidade", "prazo"],
    kpiHints: ["on-time delivery", "tempo em trânsito", "tentativas"],
  }),
  pack({
    id: "tickets",
    label: "Chamados",
    description: "Descubra onde tickets acumulam atraso, reabertura ou retrabalho.",
    exampleProcessName: "Atendimento de Chamados",
    keywords: ["ticket", "chamado", "suporte", "incident"],
    aliases: {
      caseId: ["ticket", "ticket_id", "chamado", "chamado_id", "incident_id", "protocolo"],
      activity: ["status", "etapa", "atividade", "evento", "ticket_status", "status_ticket", "acao", "ação", "fila"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "data_atualizacao", "criado_em"],
      resource: ["agente", "tecnico", "técnico", "responsavel", "responsável", "squad", "analista", "equipe_suporte"],
    },
    examples: ["Abertura à resolução", "Chamado por fila"],
    metadataSuggestions: ["prioridade", "categoria", "canal"],
    kpiHints: ["SLA", "tempo de resposta", "reabertura"],
  }),
  pack({
    id: "enrollment",
    label: "Matrículas",
    description: "Analise inscrição, documentação, aprovação e conclusão de matrículas.",
    exampleProcessName: "Processo de Matrículas",
    keywords: ["matrícula", "aluno", "inscrição", "enrollment"],
    aliases: {
      caseId: ["matricula_id", "matrícula_id", "inscricao", "inscrição", "inscricao_id", "aluno_id", "protocolo"],
      activity: ["etapa", "status", "situacao", "situação", "evento", "etapa_matricula", "status_inscricao", "fase"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "data_etapa", "data_inscricao", "atualizado_em"],
      resource: ["atendente", "secretaria", "responsavel", "responsável", "setor", "unidade", "consultor"],
    },
    examples: ["Inscrição à matrícula", "Documentação à aprovação"],
    metadataSuggestions: ["curso", "campus", "turma"],
    kpiHints: ["conversão", "tempo de matrícula", "abandono"],
  }),
  pack({
    id: "hiring",
    label: "Contratação",
    description: "Entenda o fluxo de candidatos entre inscrição, entrevista, avaliação e contratação.",
    exampleProcessName: "Processo de Contratação",
    keywords: ["vaga", "candidato", "recrutamento", "hiring"],
    aliases: {
      caseId: ["candidatura_id", "candidato_id", "application_id", "processo_seletivo", "vaga_candidato"],
      activity: ["etapa", "status", "fase", "evento", "hiring_stage", "etapa_selecao", "status_candidato", "fase_recrutamento"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "data_etapa", "data_movimentacao", "atualizado_em"],
      resource: ["recrutador", "entrevistador", "responsavel", "responsável", "rh", "gestor"],
    },
    examples: ["Candidatura à oferta", "Triagem à admissão"],
    metadataSuggestions: ["vaga", "área", "senioridade"],
    kpiHints: ["time to hire", "conversão por etapa", "abandono"],
  }),
  pack({
    id: "approvals",
    label: "Aprovações",
    description: "Encontre atrasos em solicitações, análises, aprovações e liberações.",
    exampleProcessName: "Fluxo de Aprovações",
    keywords: ["aprovação", "solicitação", "alçada", "request"],
    aliases: {
      caseId: ["solicitacao_id", "solicitação_id", "request_id", "protocolo", "documento_id", "requisicao"],
      activity: ["etapa", "status", "aprovacao", "aprovação", "evento", "etapa_aprovacao", "decisao", "decisão", "status_aprovacao"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "data_decisao", "data_movimentacao", "aprovado_em"],
      resource: ["aprovador", "responsavel", "responsável", "analista", "setor", "area", "área"],
    },
    examples: ["Solicitação à decisão", "Despesa por alçada"],
    metadataSuggestions: ["valor", "centro_custo", "tipo"],
    kpiHints: ["tempo de aprovação", "rejeições", "níveis percorridos"],
  }),
  pack({
    id: "ecommerce",
    label: "E-commerce",
    description: "Analise o caminho do pedido desde a compra até a entrega.",
    exampleProcessName: "Pedido até Entrega",
    keywords: ["checkout", "compra", "e-commerce", "order", "fulfillment"],
    aliases: {
      caseId: ["pedido_id", "order_id", "numero_pedido", "checkout_id", "compra_id"],
      activity: ["status", "etapa", "evento", "fulfillment_status", "order_status", "evento_checkout"],
      timestamp: ["data_hora", "timestamp", "data_evento", "event_time", "created_at", "event_at", "status_at"],
      resource: ["operador", "sistema", "transportadora", "centro_distribuicao", "centro_distribuição", "seller", "warehouse", "carrier"],
    },
    examples: ["Checkout à entrega", "Compra ao reembolso"],
    metadataSuggestions: ["sku", "canal", "valor"],
    kpiHints: ["fulfillment", "cancelamento", "tempo de ciclo"],
  }),
  pack({
    id: "generic",
    label: "Outro processo",
    description: "O ProcessTwin tentará reconhecer automaticamente a estrutura dos seus dados.",
    exampleProcessName: "Meu processo",
    keywords: ["processo", "evento", "case", "workflow"],
    aliases: {
      caseId: ["case", "case_id", "caseid", "id_processo", "process_id", "id"],
      activity: ["activity", "atividade", "evento", "event", "etapa", "stage", "status"],
      timestamp: ["timestamp", "datetime", "data_hora", "datahora", "date", "data", "horario", "created_at", "event_time"],
      resource: ["resource", "recurso", "responsavel", "responsável", "usuario", "usuário", "operador"],
    },
    examples: ["Processo operacional", "Jornada personalizada"],
    metadataSuggestions: ["status", "categoria", "custo"],
    kpiHints: ["tempo de ciclo", "variantes", "retrabalho"],
  }),
];

export const getProcessPack = (id: string | null | undefined) =>
  PROCESS_PACKS.find((item) => item.id === id);
