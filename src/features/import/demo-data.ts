import type { ProcessPackId } from "./process-packs";

export const DEMO_CSV_BY_PACK: Record<ProcessPackId, string> = {
  production: "ordem_producao,operacao,data_operacao,maquina\nOP-101,Corte,2026-09-01 08:00,CNC-02\nOP-101,Inspeção,2026-09-01 09:20,Qualidade\nOP-102,Corte,2026-09-01 09:30,CNC-02",
  orders: "numero_pedido,etapa_pedido,data_status,vendedor\nP-501,Recebido,2026-09-01 08:00,Ana\nP-501,Aprovado,2026-09-01 09:00,Caio\nP-502,Recebido,2026-09-01 09:10,Ana",
  deliveries: "codigo_rastreio,checkpoint,data_ocorrencia,transportadora\nBR01,Coletado,2026-09-01 08:00,RotaSul\nBR01,Em trânsito,2026-09-01 13:00,RotaSul\nBR02,Coletado,2026-09-01 09:00,RotaNorte",
  tickets: "protocolo,status_ticket,data_atualizacao,agente\nT-10,Aberto,2026-09-01 08:00,Bia\nT-10,Em análise,2026-09-01 08:20,Davi\nT-11,Aberto,2026-09-01 09:00,Bia",
  enrollment: "inscricao_id,etapa_matricula,data_etapa,atendente\nI-20,Inscrição,2026-09-01 08:00,Lia\nI-20,Documentos,2026-09-01 10:00,Lia\nI-21,Inscrição,2026-09-01 09:00,Nina",
  hiring: "candidatura_id,etapa_selecao,data_movimentacao,recrutador\nC-30,Triagem,2026-09-01 08:00,Rui\nC-30,Entrevista,2026-09-02 10:00,Sara\nC-31,Triagem,2026-09-01 09:00,Rui",
  approvals: "solicitacao_id,decisao,data_decisao,aprovador\nS-40,Enviada,2026-09-01 08:00,Ivo\nS-40,Aprovada,2026-09-01 11:00,Mia\nS-41,Enviada,2026-09-01 09:00,Ivo",
  ecommerce: "order_id,order_status,event_at,warehouse\nO-50,Created,2026-09-01 08:00,WH-01\nO-50,Paid,2026-09-01 08:05,WH-01\nO-51,Created,2026-09-01 09:00,WH-02",
  generic: "case_id,activity,timestamp,resource\nA-1,Início,2026-09-01 08:00,Time A\nA-1,Fim,2026-09-01 10:00,Time B\nA-2,Início,2026-09-01 09:00,Time A",
};
