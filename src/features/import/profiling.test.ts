import { describe, expect, it } from "vitest";
import { parseCsv } from "./parser";
import { PROFILE_SAMPLE_LIMIT, profileColumns } from "./profiling";

describe("profiling determinístico", () => {
  it("mede preenchimento, repetição, datas e números sem alterar os dados", () => {
    const parsed = parseCsv("id,etapa,quando,valor\n1,Novo,2026-01-01 08:00,10\n1,Pago,2026-01-01 09:00,20\n2,Novo,,30");
    const profiles = profileColumns(parsed);
    expect(profiles.find((profile) => profile.column === "id")).toMatchObject({ filledCount: 3, emptyCount: 0, uniqueCount: 2, numericRatio: 1 });
    expect(profiles.find((profile) => profile.column === "etapa")?.repetitionRatio).toBeCloseTo(1 / 3);
    expect(profiles.find((profile) => profile.column === "quando")).toMatchObject({ filledCount: 2, emptyCount: 1, timestampParseRatio: 1 });
  });

  it("limita amostra e exemplos para manter custo previsível", () => {
    const lines = Array.from({ length: PROFILE_SAMPLE_LIMIT + 50 }, (_, index) => `${index},Etapa ${index},2026-01-01`).join("\n");
    const [profile] = profileColumns(parseCsv(`id,atividade,data\n${lines}`));
    expect(profile?.sampledRows).toBe(PROFILE_SAMPLE_LIMIT);
    expect(profile?.sampleValues).toHaveLength(5);
  });

  it("produz sempre o mesmo perfil para a mesma entrada", () => {
    const parsed = parseCsv("x,y\na,2026-01-01\na,2026-01-02");
    expect(profileColumns(parsed)).toEqual(profileColumns(parsed));
  });

  it("não classifica identificadores alfanuméricos como datas permissivas do JavaScript", () => {
    const [profile] = profileColumns(parseCsv("pedido\nP-501\nP-502"));
    expect(profile?.timestampParseRatio).toBe(0);
  });

  it("trata dataset sem linhas sem NaN ou amostras artificiais", () => {
    const profiles = profileColumns(parseCsv("case,activity,timestamp\n"));
    expect(profiles).toHaveLength(3);
    expect(profiles.every((profile) => profile.sampledRows === 0 && profile.uniquenessRatio === 0 && profile.sampleValues.length === 0)).toBe(true);
  });
});
