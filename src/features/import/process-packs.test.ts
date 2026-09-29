import { describe, expect, it } from "vitest";
import { normalizeHeader } from "./mapping";
import { getProcessPack, PROCESS_PACKS } from "./process-packs";

describe("process packs", () => {
  it("oferece os nove nichos definidos pela V1.4", () => {
    expect(PROCESS_PACKS.map((pack) => pack.id)).toEqual(["production", "orders", "deliveries", "tickets", "enrollment", "hiring", "approvals", "ecommerce", "generic"]);
    expect(new Set(PROCESS_PACKS.map((pack) => pack.id)).size).toBe(PROCESS_PACKS.length);
  });

  it("mantém aliases completos e nomes sugeridos em todos os packs", () => {
    for (const pack of PROCESS_PACKS) {
      expect(pack.exampleProcessName.length).toBeGreaterThan(2);
      expect(Object.values(pack.aliases).every((aliases) => aliases.length > 0)).toBe(true);
      expect(Object.values(pack.aliases).flat().every((alias) => normalizeHeader(alias).length > 0)).toBe(true);
    }
  });

  it("não aceita um pack desconhecido", () => expect(getProcessPack("finance-secret")).toBeUndefined());

  it("mantém o pack genérico utilizável sem um nicho específico", () => {
    expect(getProcessPack("generic")).toMatchObject({ label: "Outro processo", exampleProcessName: "Meu processo" });
  });
});
