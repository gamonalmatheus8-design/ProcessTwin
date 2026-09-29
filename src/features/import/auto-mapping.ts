import { normalizeHeader, UNIVERSAL_COLUMN_ALIASES } from "./mapping";
import type { ProcessPack } from "./process-packs";
import type { AutoMappingResult, CanonicalField, ColumnProfile, MappingConflict, MappingSuggestion } from "./types";

const FIELDS: CanonicalField[] = ["caseId", "activity", "timestamp", "resource"];
const REQUIRED_FIELDS = new Set<CanonicalField>(["caseId", "activity", "timestamp"]);
const LABELS: Record<CanonicalField, string> = { caseId: "Case ID", activity: "Atividade", timestamp: "Timestamp", resource: "Recurso" };
type Candidate = { field: CanonicalField; column: string; score: number; reasons: string[] };

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const confidence = (score: number) => clamp(score) / 100;
const tokens = (value: string) => new Set(normalizeHeader(value).split("_").filter(Boolean));

function aliasScore(header: string, aliases: string[], exact: number, partial: number) {
  const normalized = normalizeHeader(header);
  const headerTokens = tokens(header);
  let best = 0;
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalized === normalizedAlias) best = Math.max(best, exact);
    else if (normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) best = Math.max(best, partial);
    else if ([...tokens(alias)].some((token) => token.length > 2 && headerTokens.has(token))) best = Math.max(best, partial - 8);
  }
  return best;
}

function scoreCandidate(field: CanonicalField, column: string, profile: ColumnProfile | undefined, processPack: ProcessPack): Candidate {
  const reasons: string[] = [];
  let score = 0;
  const canonicalScore = aliasScore(column, [field], 72, 38);
  const universalScore = aliasScore(column, UNIVERSAL_COLUMN_ALIASES[field], 76, 44);
  const packScore = aliasScore(column, processPack.aliases[field], 88, 54);
  const headerScore = Math.max(canonicalScore, universalScore, packScore);
  score += headerScore;
  if (packScore === headerScore && packScore > 0) reasons.push(`Nome compatível com ${processPack.label}.`);
  else if (universalScore === headerScore && universalScore > 0) reasons.push("Alias universal reconhecido.");
  else if (canonicalScore > 0) reasons.push("Nome próximo ao campo canônico.");

  if (profile?.filledCount) {
    if (field === "timestamp") {
      if (profile.timestampParseRatio >= 0.9) { score += 58; reasons.push("Quase todos os valores são datas válidas."); }
      else if (profile.timestampParseRatio >= 0.7) { score += 42; reasons.push("A maioria dos valores é uma data válida."); }
      else if (profile.timestampParseRatio < 0.35) { score -= 40; reasons.push("Poucos valores parecem datas."); }
    } else if (profile.timestampParseRatio >= 0.9) {
      score -= 34; reasons.push("A coluna parece temporal.");
    }

    if (field === "caseId") {
      if (profile.uniquenessRatio >= 0.15 && profile.uniquenessRatio <= 0.9) { score += 10; reasons.push("Cardinalidade compatível com identificadores de case repetidos."); }
      else if (profile.uniquenessRatio > 0.9) { score += 5; reasons.push("Valores têm alta cardinalidade."); }
    }
    if (field === "activity" && profile.repetitionRatio >= 0.35) { score += 14; reasons.push("Valores se repetem como etapas de um fluxo."); }
    if (field === "resource" && profile.repetitionRatio >= 0.2) { score += 9; reasons.push("Valores se repetem como responsáveis ou recursos."); }
    if ((field === "activity" || field === "resource") && profile.numericRatio > 0.9) score -= 16;
    if (profile.emptyCount > profile.filledCount) { score -= 8; reasons.push("Mais da metade da amostra está vazia."); }
  }
  return { field, column, score: clamp(score), reasons };
}

function resolveGlobally(candidates: Candidate[]) {
  const byField = new Map(FIELDS.map((field) => [field, candidates.filter((candidate) => candidate.field === field).sort((a, b) => b.score - a.score || a.column.localeCompare(b.column))]));
  let bestScore = -1;
  let best: Partial<Record<CanonicalField, Candidate>> = {};
  const visit = (index: number, used: Set<string>, total: number, selected: Partial<Record<CanonicalField, Candidate>>) => {
    if (index === FIELDS.length) {
      const signature = FIELDS.map((field) => selected[field]?.column ?? "~").join("|");
      const bestSignature = FIELDS.map((field) => best[field]?.column ?? "~").join("|");
      if (total > bestScore || (total === bestScore && signature < bestSignature)) { bestScore = total; best = { ...selected }; }
      return;
    }
    const field = FIELDS[index]!;
    visit(index + 1, used, total, selected);
    for (const candidate of byField.get(field) ?? []) {
      if (used.has(candidate.column) || candidate.score < 1) continue;
      used.add(candidate.column); selected[field] = candidate;
      const requiredBonus = REQUIRED_FIELDS.has(field) && candidate.score >= 50 ? 120 : 0;
      visit(index + 1, used, total + candidate.score + requiredBonus, selected);
      used.delete(candidate.column); delete selected[field];
    }
  };
  visit(0, new Set(), 0, {});
  return { best, byField };
}

function findConflicts(candidates: Candidate[], byField: Map<CanonicalField, Candidate[]>): MappingConflict[] {
  const conflicts: MappingConflict[] = [];
  for (const field of FIELDS) {
    const [first, second] = byField.get(field) ?? [];
    if (first && second && first.score >= 45 && first.score - second.score <= 10) conflicts.push({ type: "field", message: `${LABELS[field]} tem duas colunas com pontuações próximas.`, columns: [first.column, second.column], fields: [field] });
  }
  const columns = [...new Set(candidates.map((candidate) => candidate.column))].sort();
  for (const column of columns) {
    const ranked = candidates.filter((candidate) => candidate.column === column).sort((a, b) => b.score - a.score || FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field));
    const [first, second] = ranked;
    if (first && second && first.score >= 45 && first.score - second.score <= 10) conflicts.push({ type: "column", message: `${column} parece servir para ${LABELS[first.field]} e ${LABELS[second.field]}.`, columns: [column], fields: [first.field, second.field] });
  }
  return conflicts;
}

export function suggestColumnMappingV2(input: { headers: readonly string[]; profiles: readonly ColumnProfile[]; processPack: ProcessPack }): AutoMappingResult {
  const profileByColumn = new Map(input.profiles.map((profile) => [profile.column, profile]));
  const candidates = FIELDS.flatMap((field) => input.headers.map((column) => scoreCandidate(field, column, profileByColumn.get(column), input.processPack)));
  const { best, byField } = resolveGlobally(candidates);
  const mapping = Object.fromEntries(FIELDS.flatMap((field) => {
    const candidate = best[field];
    return candidate && candidate.score >= 50 ? [[field, candidate.column]] : [];
  }));
  const suggestions = Object.fromEntries(FIELDS.map((field) => {
    const selected = best[field];
    const ranked = byField.get(field) ?? [];
    const suggestion: MappingSuggestion = {
      field,
      column: selected?.column,
      score: selected?.score ?? 0,
      confidence: confidence(selected?.score ?? 0),
      reasons: selected?.reasons.length ? selected.reasons : ["Sem evidência suficiente para sugerir automaticamente."],
      alternatives: ranked.filter((candidate) => candidate.column !== selected?.column).slice(0, 3).map((candidate) => ({ column: candidate.column, score: candidate.score, confidence: confidence(candidate.score) })),
    };
    return [field, suggestion];
  })) as Record<CanonicalField, MappingSuggestion>;
  return { mapping, suggestions, conflicts: findConflicts(candidates, byField) };
}

export function confidenceLabel(value: number) {
  if (value >= 0.9) return "Alta";
  if (value >= 0.7) return "Boa";
  if (value >= 0.5) return "Revisar";
  return "Manual";
}
