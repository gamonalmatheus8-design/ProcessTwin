import { describe, expect, it } from "vitest";
import { suggestColumnMappingV2 } from "./auto-mapping";
import { parseCsv } from "./parser";
import { getProcessPack, PROCESS_PACKS } from "./process-packs";
import { profileColumns } from "./profiling";

const suggest = (csv: string, packId: string) => {
  const parsed = parseCsv(csv);
  return suggestColumnMappingV2({ headers: parsed.headers, profiles: profileColumns(parsed), processPack: getProcessPack(packId)! });
};

describe("Auto Mapping V2", () => {
  it.each([
    ["production", "ordem_producao,operacao,data_operacao,maquina\nOP1,Corte,2026-01-01 08:00,M1"],
    ["orders", "numero_pedido,etapa_pedido,data_status,vendedor\nP1,Novo,2026-01-01 08:00,Ana"],
    ["deliveries", "codigo_rastreio,checkpoint,data_ocorrencia,transportadora\nR1,Coleta,2026-01-01 08:00,Azul"],
    ["tickets", "protocolo,status_ticket,data_atualizacao,agente\nT1,Aberto,2026-01-01 08:00,Bia"],
    ["enrollment", "inscricao_id,etapa_matricula,data_etapa,atendente\nI1,Inscrito,2026-01-01 08:00,Caio"],
    ["hiring", "candidatura_id,etapa_selecao,data_movimentacao,recrutador\nC1,Triagem,2026-01-01 08:00,Dani"],
    ["approvals", "solicitacao_id,decisao,data_decisao,aprovador\nS1,Pendente,2026-01-01 08:00,Eli"],
    ["ecommerce", "order_id,order_status,event_at,warehouse\nO1,Paid,2026-01-01 08:00,WH1"],
    ["generic", "case_id,activity,timestamp,resource\nA,Start,2026-01-01 08:00,R1"],
  ])("mapeia o pack %s para o mesmo schema canônico", (packId, csv) => {
    expect(suggest(csv, packId).mapping).toEqual({ caseId: csv.split(",")[0], activity: csv.split(",")[1], timestamp: csv.split(",")[2], resource: csv.split(",")[3].split("\n")[0] });
  });

  it("não usa a mesma coluna em dois campos e relata ambiguidade", () => {
    const result = suggest("id,status,status_data\n1,Novo,2026-01-01\n1,Pago,2026-01-02", "orders");
    expect(new Set(Object.values(result.mapping)).size).toBe(Object.values(result.mapping).length);
    expect(result.suggestions.activity.alternatives.length).toBeGreaterThan(0);
  });

  it("usa profiling para reconhecer timestamp com cabeçalho desconhecido", () => {
    const result = suggest("protocolo,status,momento_x\n1,Novo,2026-01-01 08:00\n1,Pago,2026-01-01 09:00", "orders");
    expect(result.mapping.timestamp).toBe("momento_x");
    expect(result.suggestions.timestamp.reasons).toContain("Quase todos os valores são datas válidas.");
  });

  it("aplica boost do pack sem trocar automaticamente o pack escolhido", () => {
    const csv = "ticket_id,status,data_atualizacao\nT1,Aberto,2026-01-01";
    expect(suggest(csv, "tickets").suggestions.caseId.score).toBeGreaterThan(suggest(csv, "generic").suggestions.caseId.score);
  });

  it("expõe conflito quando dois identificadores têm scores próximos", () => {
    const result = suggest("pedido,pedido_id,status,data_status\n1,1,Novo,2026-01-01\n1,1,Pago,2026-01-02", "orders");
    expect(result.conflicts.some((conflict) => conflict.type === "field" && conflict.fields.includes("caseId"))).toBe(true);
  });

  it("não seleciona automaticamente uma sugestão fraca", () => {
    const result = suggest("banana,abacaxi,uva\nx,y,z", "generic");
    expect(result.mapping.timestamp).toBeUndefined();
    expect(result.suggestions.timestamp.confidence).toBeLessThan(0.5);
  });

  it("é determinístico e não depende de serviço externo", () => {
    const parsed = parseCsv("pedido,etapa,data_hora\n1,Novo,2026-01-01");
    const input = { headers: parsed.headers, profiles: profileColumns(parsed), processPack: PROCESS_PACKS[1]! };
    expect(suggestColumnMappingV2(input)).toEqual(suggestColumnMappingV2(input));
  });
});
