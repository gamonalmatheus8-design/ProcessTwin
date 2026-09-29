import type { CanonicalField, ColumnMapping } from "./types";

export const UNIVERSAL_COLUMN_ALIASES: Record<CanonicalField, string[]> = {
  caseId: ["case_id", "caseid", "case", "id", "pedido", "pedido_id", "numero_pedido", "processo", "process_id", "ticket", "ticket_id"],
  activity: ["activity", "atividade", "etapa", "stage", "status", "acao", "evento", "event"],
  timestamp: ["timestamp", "datetime", "data_hora", "datahora", "date", "data", "horario", "created_at", "event_time"],
  resource: ["resource", "responsavel", "usuario", "employee", "funcionario", "agent", "operador"],
};

export const normalizeHeader = (header: string) =>
  header
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

export function suggestColumnMapping(headers: readonly string[]): ColumnMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping: ColumnMapping = {};
  for (const field of Object.keys(UNIVERSAL_COLUMN_ALIASES) as CanonicalField[]) {
    const match = UNIVERSAL_COLUMN_ALIASES[field].map(normalizeHeader).find((alias) => normalized.has(alias));
    if (match) mapping[field] = normalized.get(match);
  }
  return mapping;
}

export function validateMapping(mapping: ColumnMapping, headers: readonly string[]): string[] {
  const errors: string[] = [];
  for (const field of ["caseId", "activity", "timestamp"] as const) {
    if (!mapping[field]) errors.push(`Mapeie a coluna obrigatória ${field}.`);
  }
  const selected = Object.values(mapping).filter(Boolean) as string[];
  if (new Set(selected).size !== selected.length) errors.push("Cada coluna pode ser usada apenas uma vez.");
  for (const column of selected) {
    if (!headers.includes(column)) errors.push(`A coluna ${column} não existe no CSV.`);
  }
  return errors;
}
