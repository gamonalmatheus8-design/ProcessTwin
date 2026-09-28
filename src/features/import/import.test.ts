import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCoreCycle } from "@/core/process/cycle";
import { normalizeHeader, suggestColumnMapping } from "./mapping";
import { parseCsv } from "./parser";
import { normalizeTimestamp, validateAndNormalizeCsv } from "./validation";

describe("pipeline de CSV", () => {
  it("lê CSV válido separado por vírgula", () => {
    const parsed = parseCsv("case_id,activity,timestamp\nA,Início,2026-01-01 08:00\n");
    expect(parsed.headers).toEqual(["case_id", "activity", "timestamp"]);
    expect(parsed.rows).toHaveLength(1);
  });

  it("trata arquivo vazio sem lançar exceção", () => {
    const parsed = parseCsv(" \n");
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]?.message).toContain("vazio");
  });

  it("remove BOM e detecta ponto e vírgula", () => {
    const parsed = parseCsv("\uFEFFpedido;etapa;data_hora\n1;Análise;2026-01-01 08:00");
    expect(parsed.headers[0]).toBe("pedido");
    expect(parsed.delimiter).toBe(";");
  });

  it("preserva campos entre aspas, vírgulas e acentos", () => {
    const parsed = parseCsv('case,atividade,timestamp,resource\n1,"Análise, crédito",2026-01-01 08:00,João');
    expect(parsed.rows[0]?.values.atividade).toBe("Análise, crédito");
    expect(parsed.rows[0]?.values.resource).toBe("João");
  });

  it("ignora linhas completamente vazias", () => {
    expect(parseCsv("case,activity,timestamp\n\n1,A,2026-01-01 08:00\n  \n").rows).toHaveLength(1);
  });

  it("sugere aliases comuns, inclusive com acentos", () => {
    expect(normalizeHeader(" Responsável ")).toBe("responsavel");
    expect(suggestColumnMapping(["numero_pedido", "etapa", "data_hora", "responsável"])).toEqual({
      caseId: "numero_pedido", activity: "etapa", timestamp: "data_hora", resource: "responsável",
    });
  });

  it("aceita mapeamento manual com nomes não reconhecidos", () => {
    const parsed = parseCsv("chave,fase,quando\nA,Recebido,2026-01-01 08:00");
    const result = validateAndNormalizeCsv(parsed, { caseId: "chave", activity: "fase", timestamp: "quando" });
    expect(result.events[0]).toMatchObject({ caseId: "A", activity: "Recebido" });
  });

  it("rejeita ausência de coluna obrigatória", () => {
    const parsed = parseCsv("case,activity\nA,Início");
    const result = validateAndNormalizeCsv(parsed, { caseId: "case", activity: "activity" });
    expect(result.events).toHaveLength(0);
    expect(result.errors.some((error) => error.message.includes("timestamp"))).toBe(true);
  });

  it("não ignora timestamp inválido silenciosamente", () => {
    const parsed = parseCsv("case,activity,timestamp\nA,Início,nunca");
    const result = validateAndNormalizeCsv(parsed, { caseId: "case", activity: "activity", timestamp: "timestamp" });
    expect(result.summary.invalidRows).toBe(1);
    expect(result.errors[0]).toMatchObject({ rowNumber: 2, field: "timestamp", value: "nunca" });
  });

  it("normaliza whitespace, recurso opcional e timestamp de forma determinística", () => {
    const parsed = parseCsv("case,activity,timestamp,resource\n A , Aprovação ,2026-09-15 13:40, Carlos ");
    const result = validateAndNormalizeCsv(parsed, { caseId: "case", activity: "activity", timestamp: "timestamp", resource: "resource" });
    expect(result.events[0]).toEqual({ caseId: "A", activity: "Aprovação", timestamp: "2026-09-15T13:40:00.000Z", resource: "Carlos" });
  });

  it("calcula cases e atividades com IDs repetidos e eventos fora de ordem", () => {
    const parsed = parseCsv("case,activity,timestamp\nA,Fim,2026-01-01 10:00\nA,Início,2026-01-01 08:00\nB,Início,2026-01-02 08:00");
    const result = validateAndNormalizeCsv(parsed, { caseId: "case", activity: "activity", timestamp: "timestamp" });
    expect(result.summary).toMatchObject({ validRows: 3, caseCount: 2, activityCount: 2 });
    expect(result.summary.periodStart).toBe("2026-01-01T08:00:00.000Z");
  });

  it("valida datas de calendário e aceita ISO com offset", () => {
    expect(normalizeTimestamp("2026-02-30 10:00")).toBeNull();
    expect(normalizeTimestamp("2026-02-30")).toBeNull();
    expect(normalizeTimestamp("2026-09-15T13:40:00-03:00")).toBe("2026-09-15T16:40:00.000Z");
  });

  it("reporta erros estruturais de parsing", () => {
    const parsed = parseCsv('case,activity,timestamp\nA,"campo sem fim,2026-01-01 08:00');
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("faz o CSV de exemplo chegar ao Core Cycle com Aprovação como gargalo", () => {
    const contents = readFileSync(new URL("../../../examples/order-process.csv", import.meta.url), "utf8");
    const parsed = parseCsv(contents);
    const validation = validateAndNormalizeCsv(parsed, suggestColumnMapping(parsed.headers));
    expect(validation.summary).toMatchObject({ validRows: 52, caseCount: 12, invalidRows: 0 });
    expect(runCoreCycle(validation.events).bottleneck?.activity).toBe("Aprovação");
  });
});
