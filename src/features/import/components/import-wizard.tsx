"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { suggestColumnMapping } from "../mapping";
import { parseCsv } from "../parser";
import type { CanonicalField, ColumnMapping, ImportAnalysisResponse, ImportContext, ParsedCsv } from "../types";
import { validateAndNormalizeCsv } from "../validation";
import { AnalysisResult } from "./analysis-result";

const fields: Array<{ key: CanonicalField; label: string; required: boolean }> = [
  { key: "caseId", label: "Case ID", required: true }, { key: "activity", label: "Atividade", required: true },
  { key: "timestamp", label: "Timestamp", required: true }, { key: "resource", label: "Recurso", required: false },
];
const steps = ["Processo", "Arquivo", "Mapeamento", "Validação", "Resultado"];

export function ImportWizard() {
  const [context, setContext] = useState<ImportContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [step, setStep] = useState(0); const [mode, setMode] = useState<"existing" | "new">("existing");
  const [processId, setProcessId] = useState(""); const [organizationId, setOrganizationId] = useState(""); const [processName, setProcessName] = useState("");
  const [file, setFile] = useState<File | null>(null); const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({}); const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false); const [result, setResult] = useState<ImportAnalysisResponse | null>(null);

  const loadContext = async () => {
    setLoadingContext(true); setContextError("");
    try {
      const response = await fetch("/api/import/context", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json() as ImportContext; setContext(data);
        const writable = data.organizations.find((organization) => organization.canImport); setOrganizationId(writable?.id ?? "");
        const availableProcess = data.processes.find((process) => data.organizations.some((organization) => organization.id === process.organizationId && organization.canImport));
        setProcessId(availableProcess?.id ?? ""); if (!availableProcess) setMode("new");
      } else { setContext(null); setContextError(response.status === 401 ? "Faça login para acessar suas organizações e importar dados." : "Não foi possível carregar suas organizações."); }
    } catch { setContext(null); setContextError("Não foi possível conectar ao serviço de dados."); }
    finally { setLoadingContext(false); }
  };
  useEffect(() => { void loadContext(); }, []);

  const validation = useMemo(() => parsed ? validateAndNormalizeCsv(parsed, mapping) : null, [parsed, mapping]);
  const selectedProcess = context?.processes.find((process) => process.id === processId);
  const effectiveOrganizationId = mode === "existing" ? selectedProcess?.organizationId ?? "" : organizationId;

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) { setError("Não foi possível entrar. Verifique e-mail e senha."); return; }
    await loadContext();
  };

  const chooseFile = async (selected: File | null) => {
    setError(""); setResult(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".csv") || selected.size > 10 * 1024 * 1024) { setError("Selecione um CSV de até 10 MB."); return; }
    const nextParsed = parseCsv(await selected.text()); setFile(selected); setParsed(nextParsed); setMapping(suggestColumnMapping(nextParsed.headers));
  };

  const submit = async () => {
    if (!file || !validation?.events.length) return;
    setSubmitting(true); setError("");
    const form = new FormData(); form.set("file", file); form.set("mapping", JSON.stringify(mapping)); form.set("organizationId", effectiveOrganizationId);
    if (mode === "existing") form.set("processId", processId); else form.set("processName", processName.trim());
    const response = await fetch("/api/import/process-events", { method: "POST", body: form });
    const body = await response.json() as ImportAnalysisResponse & { error?: string };
    if (!response.ok) setError(body.error ?? "A importação não pôde ser concluída."); else { setResult(body); setStep(4); }
    setSubmitting(false);
  };

  if (loadingContext) return <div className="panel">Carregando contexto seguro…</div>;
  if (!context) return <section className="panel auth-panel"><span className="eyebrow">Acesso seguro</span><h2>Entre para importar dados</h2><p>{contextError}</p><form onSubmit={signIn} className="form-stack"><label>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="error-banner">{error}</div>}<button className="button" type="submit">Entrar</button></form></section>;

  const writableOrganizations = context.organizations.filter((organization) => organization.canImport);
  const writableProcesses = context.processes.filter((process) => writableOrganizations.some((organization) => organization.id === process.organizationId));

  return <div className="wizard">
    <ol className="steps">{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label}><span>{index + 1}</span>{label}</li>)}</ol>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {step === 0 && <section className="panel"><span className="eyebrow">Etapa 1</span><h2>Onde este log deve ser analisado?</h2><div className="choice-grid"><button className={mode === "existing" ? "choice selected" : "choice"} onClick={() => setMode("existing")} type="button">Processo existente</button><button className={mode === "new" ? "choice selected" : "choice"} onClick={() => setMode("new")} type="button">Novo processo</button></div>{mode === "existing" ? <label>Processo<select value={processId} onChange={(event) => setProcessId(event.target.value)}><option value="">Selecione</option>{writableProcesses.map((process) => <option value={process.id} key={process.id}>{process.name}</option>)}</select></label> : <div className="two-columns"><label>Organização<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Selecione</option>{writableOrganizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></label><label>Nome do processo<input maxLength={160} value={processName} onChange={(event) => setProcessName(event.target.value)} placeholder="Ex.: Pedido ao pagamento" /></label></div>}<div className="actions"><button className="button" disabled={mode === "existing" ? !processId : !organizationId || processName.trim().length < 2} onClick={() => setStep(1)}>Continuar</button></div></section>}
    {step === 1 && <section className="panel"><span className="eyebrow">Etapa 2</span><h2>Selecione o event log</h2><p>CSV com case, atividade e timestamp. O arquivo pode usar os nomes da sua operação; você mapeará as colunas a seguir.</p><label className="dropzone">Arquivo CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} /><span>{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "Escolher CSV de até 10 MB"}</span></label>{parsed && <p>{parsed.rows.length} linhas detectadas · delimitador {parsed.delimiter === ";" ? "ponto e vírgula" : "vírgula"}</p>}<div className="actions"><button className="button secondary" onClick={() => setStep(0)}>Voltar</button><button className="button" disabled={!parsed?.headers.length} onClick={() => setStep(2)}>Mapear colunas</button></div></section>}
    {step === 2 && parsed && <section className="panel"><span className="eyebrow">Etapa 3</span><h2>Confirme o mapeamento</h2><p>As sugestões abaixo foram inferidas do cabeçalho. Você continua no controle.</p><div className="mapping-grid">{fields.map((field) => <label key={field.key}>{field.label} {field.required && <em>obrigatório</em>}<select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined }))}><option value="">Não mapear</option>{parsed.headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}</div><div className="actions"><button className="button secondary" onClick={() => setStep(1)}>Voltar</button><button className="button" disabled={!mapping.caseId || !mapping.activity || !mapping.timestamp} onClick={() => setStep(3)}>Validar dados</button></div></section>}
    {step === 3 && validation && <section className="panel"><span className="eyebrow">Etapa 4</span><h2>Revise antes de importar</h2><div className="summary-grid">{[["Linhas", validation.summary.totalRows], ["Válidas", validation.summary.validRows], ["Inválidas", validation.summary.invalidRows], ["Cases", validation.summary.caseCount], ["Atividades", validation.summary.activityCount]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{validation.summary.periodStart && <p>Período: {new Date(validation.summary.periodStart).toLocaleString("pt-BR")} — {new Date(validation.summary.periodEnd!).toLocaleString("pt-BR")}</p>}{validation.errors.length > 0 && <div className="warning-banner"><strong>{validation.errors.length} problema(s) detectado(s).</strong><ul>{validation.errors.slice(0, 5).map((item, index) => <li key={`${item.rowNumber}-${index}`}>Linha {item.rowNumber}: {item.message}{item.value ? ` (${item.value})` : ""}</li>)}</ul></div>}<div className="table-wrap"><table><thead><tr><th>Case ID</th><th>Atividade</th><th>Timestamp normalizado</th><th>Recurso</th></tr></thead><tbody>{validation.preview.map((event, index) => <tr key={`${event.caseId}-${index}`}><td>{event.caseId}</td><td>{event.activity}</td><td>{event.timestamp}</td><td>{event.resource || "—"}</td></tr>)}</tbody></table></div><div className="actions"><button className="button secondary" onClick={() => setStep(2)}>Ajustar mapeamento</button><button className="button" disabled={!validation.events.length || submitting} onClick={() => void submit()}>{submitting ? "Salvando e analisando…" : "Confirmar importação"}</button></div></section>}
    {step === 4 && result && <><AnalysisResult result={result} /><div className="actions"><button className="button secondary" onClick={() => { setStep(1); setResult(null); setFile(null); setParsed(null); }}>Importar outro CSV</button></div></>}
  </div>;
}
