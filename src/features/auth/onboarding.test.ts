import { describe, expect, it } from "vitest";
import {
  normalizeOrganizationName,
  organizationNameFromUser,
  organizationSlug,
} from "./onboarding";

describe("account onboarding", () => {
  it("normaliza o nome da organização", () => {
    expect(normalizeOrganizationName("  Loja   Central  ")).toBe("Loja Central");
  });

  it("usa fallback para nomes vazios", () => {
    expect(normalizeOrganizationName(" ")).toBe("Minha organização");
  });

  it("gera slug determinístico e seguro", () => {
    const slug = organizationSlug(
      "Indústria São João & Filhos",
      "5F97782D-3A8C-401C-AE12-ABCD12345678",
    );
    expect(slug).toBe("industria-sao-joao-filhos-5f97782d3a");
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("usa o nome informado antes do metadata", () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      user_metadata: { organization_name: "Organização Metadata" },
    } as any;

    expect(organizationNameFromUser(user, "Empresa Informada")).toBe("Empresa Informada");
  });

  it("usa metadata apenas como nome, não como autorização", () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      user_metadata: { organization_name: "Equipe Demo", role: "owner" },
    } as any;

    expect(organizationNameFromUser(user)).toBe("Equipe Demo");
  });
});
