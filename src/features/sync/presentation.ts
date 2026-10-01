import type { IdentityConfig, SyncRun } from "./types";

export const identityLabel: Record<IdentityConfig["strategy"], string> = {
  source_id: "ID único da fonte", source_fields: "Combinação de campos", canonical_fingerprint: "Automático",
};
const states: Record<string, string> = {
  draft: "Em configuração", active: "Ativo", paused: "Pausado", disabled: "Desativado", needs_attention: "Requer atenção", needs_reauth: "Reconectar conta",
  running: "Em andamento", succeeded: "Concluída", partial: "Concluída com ressalvas", failed: "Falhou", cancelled: "Cancelada",
};
const analysisStates: Record<SyncRun["analysis_status"], string> = {
  pending: "Aguardando análise", skipped: "Sem novas mudanças", succeeded: "Concluída", failed: "Precisa ser executada novamente", superseded: "Substituída por outra revisão",
};
export const syncStateLabel = (state: string) => states[state] ?? "Estado indisponível";
export const analysisStateLabel = (state: SyncRun["analysis_status"]) => analysisStates[state];
export const canonicalFieldLabel: Record<string, string> = {caseId: "Caso", activity: "Atividade", timestamp: "Data e hora", resource: "Responsável"};
