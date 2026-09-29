import type { ProcessPackId } from "./process-packs";

export const DEMO_CSV_BY_PACK: Record<ProcessPackId, string> = {
  production: `ordem_producao,operacao,data_operacao,maquina
OP-101,Corte,2026-09-01 08:00,CNC-02
OP-101,Montagem,2026-09-01 09:00,Linha-A
OP-101,Inspeção,2026-09-01 11:30,Qualidade-1
OP-101,Embalagem,2026-09-01 12:10,Linha-A
OP-102,Corte,2026-09-01 08:20,CNC-01
OP-102,Montagem,2026-09-01 09:30,Linha-B
OP-102,Inspeção,2026-09-01 13:40,Qualidade-1
OP-102,Embalagem,2026-09-01 14:10,Linha-B`,
  orders: `numero_pedido,etapa_pedido,data_status,vendedor
P-501,Recebido,2026-09-01 08:00,Ana
P-501,Pagamento aprovado,2026-09-01 08:20,Caio
P-501,Separação,2026-09-01 09:10,Bia
P-501,Faturado,2026-09-01 09:40,Caio
P-502,Recebido,2026-09-01 08:30,Ana
P-502,Pagamento aprovado,2026-09-01 09:00,Caio
P-502,Separação,2026-09-01 12:30,Bia
P-502,Faturado,2026-09-01 13:00,Caio`,
  deliveries: `codigo_rastreio,checkpoint,data_ocorrencia,transportadora
BR01,Coletado,2026-09-01 08:00,RotaSul
BR01,Centro de distribuição,2026-09-01 10:00,RotaSul
BR01,Em rota,2026-09-01 13:00,RotaSul
BR01,Entregue,2026-09-01 15:00,RotaSul
BR02,Coletado,2026-09-01 08:30,RotaNorte
BR02,Centro de distribuição,2026-09-01 11:00,RotaNorte
BR02,Em rota,2026-09-01 17:30,RotaNorte
BR02,Entregue,2026-09-01 19:00,RotaNorte`,
  tickets: `protocolo,status_ticket,data_atualizacao,agente
T-10,Aberto,2026-09-01 08:00,Bia
T-10,Triagem,2026-09-01 08:20,Davi
T-10,Em análise,2026-09-01 09:00,Davi
T-10,Resolvido,2026-09-01 10:00,Bia
T-11,Aberto,2026-09-01 08:30,Bia
T-11,Triagem,2026-09-01 08:50,Davi
T-11,Em análise,2026-09-01 13:30,Eli
T-11,Resolvido,2026-09-01 14:20,Eli`,
  enrollment: `inscricao_id,etapa_matricula,data_etapa,atendente
I-20,Inscrição,2026-09-01 08:00,Lia
I-20,Documentos,2026-09-01 08:30,Lia
I-20,Análise,2026-09-01 10:00,Nina
I-20,Matrícula confirmada,2026-09-01 11:00,Nina
I-21,Inscrição,2026-09-01 08:30,Lia
I-21,Documentos,2026-09-01 09:00,Lia
I-21,Análise,2026-09-01 13:40,Nina
I-21,Matrícula confirmada,2026-09-01 14:20,Nina`,
  hiring: `candidatura_id,etapa_selecao,data_movimentacao,recrutador
C-30,Candidatura,2026-09-01 08:00,Rui
C-30,Triagem,2026-09-01 10:00,Rui
C-30,Entrevista,2026-09-02 10:00,Sara
C-30,Oferta,2026-09-02 16:00,Sara
C-31,Candidatura,2026-09-01 08:30,Rui
C-31,Triagem,2026-09-01 10:30,Rui
C-31,Entrevista,2026-09-04 10:00,Sara
C-31,Oferta,2026-09-04 16:00,Sara`,
  approvals: `solicitacao_id,decisao,data_decisao,aprovador
S-40,Enviada,2026-09-01 08:00,Ivo
S-40,Conferência,2026-09-01 08:30,Ivo
S-40,Análise,2026-09-01 09:00,Mia
S-40,Aprovada,2026-09-01 11:00,Mia
S-41,Enviada,2026-09-01 08:30,Ivo
S-41,Conferência,2026-09-01 09:00,Ivo
S-41,Análise,2026-09-01 14:00,Mia
S-41,Aprovada,2026-09-01 15:00,Mia`,
  ecommerce: `order_id,order_status,event_at,warehouse
O-50,Created,2026-09-01 08:00,WH-01
O-50,Paid,2026-09-01 08:05,WH-01
O-50,Packed,2026-09-01 09:00,WH-01
O-50,Delivered,2026-09-01 14:00,Carrier-A
O-51,Created,2026-09-01 08:30,WH-02
O-51,Paid,2026-09-01 08:40,WH-02
O-51,Packed,2026-09-01 13:20,WH-02
O-51,Delivered,2026-09-01 18:00,Carrier-B`,
  generic: `case_id,activity,timestamp,resource
A-1,Início,2026-09-01 08:00,Time A
A-1,Validação,2026-09-01 08:30,Time B
A-1,Execução,2026-09-01 10:00,Time A
A-1,Fim,2026-09-01 11:00,Time B
A-2,Início,2026-09-01 09:00,Time A
A-2,Validação,2026-09-01 09:30,Time B
A-2,Execução,2026-09-01 13:30,Time A
A-2,Fim,2026-09-01 14:30,Time B`,
};
