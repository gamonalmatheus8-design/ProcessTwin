import type { CanonicalField } from "./types";

export type ProcessPackId = "production" | "orders" | "deliveries" | "tickets" | "enrollment" | "hiring" | "approvals" | "ecommerce" | "generic";

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
  pack({ id: "production", label: "Produção", description: "Ordens, operações e recursos do chão de fábrica.", exampleProcessName: "Processo de Produção", keywords: ["produção", "ordem", "operação"], aliases: { caseId: ["ordem_producao", "op", "lote"], activity: ["operacao", "posto", "etapa_producao"], timestamp: ["data_operacao", "inicio_operacao", "fim_operacao"], resource: ["maquina", "operador", "centro_trabalho"] }, examples: ["Ordem à conclusão", "Lote por operação"], metadataSuggestions: ["quantidade", "produto", "turno"], kpiHints: ["lead time", "retrabalho", "tempo de espera"] }),
  pack({ id: "orders", label: "Pedidos", description: "Do recebimento do pedido ao faturamento.", exampleProcessName: "Pedido ao faturamento", keywords: ["pedido", "venda", "cliente"], aliases: { caseId: ["pedido", "pedido_id", "numero_pedido"], activity: ["etapa_pedido", "status_pedido", "evento_pedido"], timestamp: ["data_pedido", "data_status", "movimentado_em"], resource: ["vendedor", "responsavel", "equipe"] }, examples: ["Pedido ao pagamento", "Cotação à venda"], metadataSuggestions: ["cliente", "valor", "canal"], kpiHints: ["tempo de ciclo", "conversão", "atrasos"] }),
  pack({ id: "deliveries", label: "Entregas", description: "Expedição, transporte e confirmação de entrega.", exampleProcessName: "Expedição à entrega", keywords: ["entrega", "remessa", "rastreamento"], aliases: { caseId: ["entrega_id", "remessa", "codigo_rastreio"], activity: ["status_entrega", "ocorrencia", "checkpoint"], timestamp: ["data_ocorrencia", "atualizado_em", "data_entrega"], resource: ["transportadora", "motorista", "hub"] }, examples: ["Coleta à entrega", "Remessa por checkpoint"], metadataSuggestions: ["rota", "cidade", "prazo"], kpiHints: ["on-time delivery", "tempo em trânsito", "tentativas"] }),
  pack({ id: "tickets", label: "Chamados", description: "Atendimento de chamados e suporte ao cliente.", exampleProcessName: "Atendimento de Chamados", keywords: ["ticket", "chamado", "suporte"], aliases: { caseId: ["ticket_id", "chamado", "protocolo"], activity: ["status_ticket", "acao", "fila"], timestamp: ["data_atualizacao", "criado_em", "data_evento"], resource: ["agente", "analista", "equipe_suporte"] }, examples: ["Abertura à resolução", "Chamado por fila"], metadataSuggestions: ["prioridade", "categoria", "canal"], kpiHints: ["SLA", "tempo de resposta", "reabertura"] }),
  pack({ id: "enrollment", label: "Matrículas", description: "Jornada de inscrição, documentação e matrícula.", exampleProcessName: "Inscrição à matrícula", keywords: ["matrícula", "aluno", "inscrição"], aliases: { caseId: ["inscricao_id", "matricula_id", "candidato_id"], activity: ["etapa_matricula", "status_inscricao", "fase"], timestamp: ["data_etapa", "data_inscricao", "atualizado_em"], resource: ["atendente", "unidade", "consultor"] }, examples: ["Lead à matrícula", "Inscrição à aprovação"], metadataSuggestions: ["curso", "campus", "turma"], kpiHints: ["conversão", "tempo de matrícula", "abandono"] }),
  pack({ id: "hiring", label: "Contratação", description: "Recrutamento, entrevistas e admissão.", exampleProcessName: "Processo de Contratação", keywords: ["vaga", "candidato", "recrutamento"], aliases: { caseId: ["candidato_id", "candidatura_id", "vaga_candidato"], activity: ["etapa_selecao", "status_candidato", "fase_recrutamento"], timestamp: ["data_etapa", "data_movimentacao", "atualizado_em"], resource: ["recrutador", "entrevistador", "gestor"] }, examples: ["Candidatura à oferta", "Triagem à admissão"], metadataSuggestions: ["vaga", "área", "senioridade"], kpiHints: ["time to hire", "conversão por etapa", "abandono"] }),
  pack({ id: "approvals", label: "Aprovações", description: "Solicitações que percorrem níveis de decisão.", exampleProcessName: "Solicitação à aprovação", keywords: ["aprovação", "solicitação", "alçada"], aliases: { caseId: ["solicitacao_id", "requisicao", "documento_id"], activity: ["etapa_aprovacao", "decisao", "status_aprovacao"], timestamp: ["data_decisao", "data_movimentacao", "aprovado_em"], resource: ["aprovador", "responsavel", "area"] }, examples: ["Requisição à decisão", "Despesa por alçada"], metadataSuggestions: ["valor", "centro_custo", "tipo"], kpiHints: ["tempo de aprovação", "rejeições", "níveis percorridos"] }),
  pack({ id: "ecommerce", label: "E-commerce", description: "Compra online, pagamento, separação e envio.", exampleProcessName: "Compra à entrega", keywords: ["checkout", "compra", "e-commerce"], aliases: { caseId: ["order_id", "checkout_id", "compra_id"], activity: ["order_status", "evento_checkout", "fulfillment_status"], timestamp: ["event_at", "status_at", "created_at"], resource: ["seller", "warehouse", "carrier"] }, examples: ["Checkout à entrega", "Compra ao reembolso"], metadataSuggestions: ["sku", "canal", "valor"], kpiHints: ["conversão", "fulfillment", "cancelamento"] }),
  pack({ id: "generic", label: "Outro processo", description: "Mapeamento universal para qualquer event log.", exampleProcessName: "Meu processo", keywords: ["processo", "evento", "case"], aliases: { caseId: ["case", "case_id", "id_processo"], activity: ["activity", "atividade", "evento"], timestamp: ["timestamp", "data_hora", "event_time"], resource: ["resource", "recurso", "responsavel"] }, examples: ["Processo operacional", "Jornada personalizada"], metadataSuggestions: ["status", "categoria", "custo"], kpiHints: ["tempo de ciclo", "variantes", "retrabalho"] }),
];

export const getProcessPack = (id: string | null | undefined) => PROCESS_PACKS.find((item) => item.id === id);
