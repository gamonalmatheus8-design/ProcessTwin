"use client";

import { useMemo, useState } from "react";
import { suggestColumnMappingV2 } from "@/features/import/auto-mapping";
import { AutoMappingPanel } from "@/features/import/components/auto-mapping-panel";
import { validateMapping } from "@/features/import/mapping";
import { parseCsv } from "@/features/import/parser";
import { getProcessPack, PROCESS_PACKS, type ProcessPackId } from "@/features/import/process-packs";
import { profileColumns } from "@/features/import/profiling";
import type { ColumnMapping, ParsedCsv } from "@/features/import/types";
import { validateAndNormalizeCsv } from "@/features/import/validation";
import type { IdentityConfig, SyncResponse } from "../types";

const steps = ["Fonte", "Arquivo", "Mapeamento", "Identidade do evento", "Revisão", "Sincronização"];
export function ConnectorSetup({ processId, onResult, onClose }: { processId: string; onResult: (result: SyncResponse) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("CSV de pedidos");
  const [pack, setPack] = useState<ProcessPackId>("generic");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [identity, setIdentity] = useState<IdentityConfig>({ strategy: "canonical_fingerprint", fields: [], version: "v1" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestion = useMemo(() => parsed ? suggestColumnMappingV2({ headers: parsed.headers, profiles: profileColumns(parsed), processPack: getProcessPack(pack)! }) : null, [parsed, pack]);
  const validation = useMemo(() => parsed && !validateMapping(mapping, parsed.headers).length ? validateAndNormalizeCsv(parsed, mapping) : null, [parsed, mapping]);

  async function selectFile(selected: File | undefined) {
    setError("");
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".csv") || selected.size > 4 * 1024 * 1024 || !selected.size) { setError("Selecione um CSV entre 1 byte e 4 MB."); return; }
    const source = parseCsv(await selected.text());
    if (!source.rows.length || source.rows.length > 20000 || source.headers.length > 64 || source.duplicateHeaders) { setError("Envie até 20.000 registros e 64 colunas, com cabeçalhos únicos."); return; }
    setFile(selected); setParsed(source);
    setMapping(suggestColumnMappingV2({ headers: source.headers, profiles: profileColumns(source), processPack: getProcessPack(pack)! }).mapping);
    setIdentity({ strategy: source.headers.includes("event_id") ? "source_id" : "canonical_fingerprint", fields: source.headers.includes("event_id") ? ["event_id"] : [], version: "v1" });
  }
  async function submit() {
    if (!file || busy) return;
    setBusy(true); setStep(5); setError("");
    const form = new FormData(); form.set("file", file); form.set("name", name); form.set("processPackId", pack);
    form.set("mapping", JSON.stringify(mapping)); form.set("identity", JSON.stringify(identity));
    try {
      const response = await fetch(`/api/processes/${processId}/connectors`, { method: "POST", body: form });
      const result = await response.json();
      if (result.run) { onResult(result); onClose(); } else { setError(result.error ?? "Não foi possível sincronizar."); setStep(4); }
    } catch { setError("Conexão interrompida. Verifique o histórico antes de tentar novamente."); setStep(4); }
    finally { setBusy(false); }
  }
  const canAdvance = step === 0 ? name.trim().length >= 2 && name.trim().length <= 160
    : step === 1 ? Boolean(file) : step === 2 ? Boolean(validation?.events.length)
    : identity.strategy === "canonical_fingerprint" || (identity.strategy === "source_id" ? identity.fields.length === 1 : identity.fields.length > 0);
  return <section className="panel wizard" aria-busy={busy}>
    <span className="eyebrow">Novo conector</span><h2>Conectar CSV recorrente</h2>
    <ol className="steps steps-six">{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label} aria-current={step === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    {step === 0 && <><p>Uma fonte manual alimenta sempre o mesmo Live Dataset.</p><div className="two-columns"><label>Nome<input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></label><label>Process Pack (opcional)<select value={pack} onChange={(event) => setPack(event.target.value as ProcessPackId)}>{PROCESS_PACKS.map((p) => <option value={p.id} key={p.id}>{p.label}</option>)}</select></label></div></>}
    {step === 1 && <><label className="dropzone"><span>{file?.name ?? "Selecionar primeiro CSV"}</span><input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])} /></label><p>Até 4 MB, 20.000 registros e 64 colunas. O original será arquivado em armazenamento privado.</p></>}
    {step === 2 && parsed && suggestion && <><p>Confirme ou corrija o Auto Mapping V2. Este mapeamento será mantido nas próximas sincronizações.</p><AutoMappingPanel headers={parsed.headers} mapping={mapping} analysis={suggestion} onChange={setMapping} /><p>{validation?.summary.validRows ?? 0} registros válidos · {validation?.summary.invalidRows ?? 0} inválidos</p></>}
    {step === 3 && parsed && <><h3>Como devemos reconhecer o mesmo evento em novas exportações?</h3><p>Prefira um ID estável do sistema de origem quando existir.</p><label>Estratégia<select value={identity.strategy} onChange={(event) => setIdentity({ strategy: event.target.value as IdentityConfig["strategy"], fields: [], version: "v1" })}><option value="source_id">ID único da fonte</option><option value="source_fields">Combinação de campos</option><option value="canonical_fingerprint">Automático</option></select></label>
      {identity.strategy === "source_id" && <label>Coluna do ID<select value={identity.fields[0] ?? ""} onChange={(event) => setIdentity({ ...identity, fields: event.target.value ? [event.target.value] : [] })}><option value="">Selecione</option>{parsed.headers.map((column) => <option key={column}>{column}</option>)}</select></label>}
      {identity.strategy === "source_fields" && <fieldset className="identity-fields"><legend>Campos estáveis</legend>{parsed.headers.map((column) => <label key={column}><input type="checkbox" checked={identity.fields.includes(column)} onChange={(event) => setIdentity({ ...identity, fields: event.target.checked ? [...identity.fields, column] : identity.fields.filter((field) => field !== column) })} />{column}</label>)}</fieldset>}
      {identity.strategy === "canonical_fingerprint" && <p>No modo automático, alterar Case ID, atividade, timestamp ou recurso cria uma nova identidade. Use um ID da fonte para reconhecer correções nesses campos.</p>}</>}
    {step === 4 && <><h3>Revise antes de conectar</h3><dl className="sync-review"><dt>Nome</dt><dd>{name}</dd><dt>Process Pack</dt><dd>{getProcessPack(pack)?.label}</dd><dt>Arquivo</dt><dd>{file?.name}</dd><dt>Mapeamento</dt><dd>{Object.entries(mapping).map(([field, column]) => `${field} → ${column}`).join(" · ")}</dd><dt>Identidade</dt><dd>{identity.strategy} {identity.fields.join(" + ")}</dd><dt>Quantidade</dt><dd>{parsed?.rows.length} linhas · {validation?.summary.caseCount} cases · {validation?.summary.activityCount} atividades</dd></dl><p>Os registros válidos serão incorporados ao Live Dataset. Acima de 20% de inválidos, o sync será interrompido.</p></>}
    {step === 5 && <p role="status">Arquivando CSV, sincronizando eventos e analisando o dataset vivo…</p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    <div className="actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button>{step > 0 && step < 5 && <button className="button secondary" type="button" onClick={() => setStep(step - 1)}>Voltar</button>}{step < 4 && <button className="button" type="button" disabled={!canAdvance} onClick={() => setStep(step + 1)}>Continuar</button>}{step === 4 && <button className="button" type="button" onClick={() => void submit()}>Confirmar e sincronizar</button>}</div>
  </section>;
}
