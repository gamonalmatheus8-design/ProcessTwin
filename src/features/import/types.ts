import type { CoreCycleResult, ProcessEvent } from "@/core/process/types";

export type CanonicalField = "caseId" | "activity" | "timestamp" | "resource";
export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export type ColumnProfile = {
  column: string;
  sampledRows: number;
  filledCount: number;
  emptyCount: number;
  uniqueCount: number;
  uniquenessRatio: number;
  repetitionRatio: number;
  timestampParseRatio: number;
  numericRatio: number;
  sampleValues: string[];
};

export type MappingAlternative = { column: string; score: number; confidence: number };
export type MappingSuggestion = {
  field: CanonicalField;
  column?: string;
  score: number;
  confidence: number;
  reasons: string[];
  alternatives: MappingAlternative[];
};
export type MappingConflict = {
  type: "column" | "field";
  message: string;
  columns: string[];
  fields: CanonicalField[];
};
export type AutoMappingResult = {
  mapping: ColumnMapping;
  suggestions: Record<CanonicalField, MappingSuggestion>;
  conflicts: MappingConflict[];
};

export type CsvRow = { rowNumber: number; values: Record<string, string> };
export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
  delimiter: string;
  errors: Array<{ row?: number; message: string }>;
};

export type RowValidationError = {
  rowNumber: number;
  field: CanonicalField | "csv";
  message: string;
  value?: string;
};

export type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  caseCount: number;
  activityCount: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type ImportValidation = {
  events: ProcessEvent[];
  errors: RowValidationError[];
  preview: ProcessEvent[];
  summary: ImportSummary;
};

export type ImportAnalysisResponse = {
  dataset: { id: string; name: string; storagePath: string };
  process: { id: string; name: string };
  validation: ImportSummary;
  analysis: CoreCycleResult;
};

export type ImportContext = {
  user: { id: string; email: string | null };
  organizations: Array<{ id: string; name: string; canImport: boolean }>;
  processes: Array<{ id: string; organizationId: string; name: string }>;
};
