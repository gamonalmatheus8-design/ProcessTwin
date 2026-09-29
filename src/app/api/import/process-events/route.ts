import { NextResponse } from "next/server";
import { runCoreCycle } from "@/core/process/cycle";
import { suggestColumnMappingV2 } from "@/features/import/auto-mapping";
import { parseCsv } from "@/features/import/parser";
import { getProcessPack } from "@/features/import/process-packs";
import { profileColumns } from "@/features/import/profiling";
import type { ColumnMapping } from "@/features/import/types";
import { validateAndNormalizeCsv } from "@/features/import/validation";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["text/csv", "application/vnd.ms-excel", "text/plain", ""]);
const IMPORT_ROLES = new Set(["owner", "admin", "analyst"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const responseError = (message: string, status: number, details?: unknown) =>
  NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });

const safeFilename = (name: string) => {
  const base = name.replace(/\.csv$/i, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "dataset";
  return `${base}.csv`;
};

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return responseError("Envie os dados como multipart/form-data.", 415);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return responseError("Autenticação necessária.", 401);

  let form: FormData;
  try { form = await request.formData(); } catch { return responseError("Payload multipart inválido.", 400); }

  const file = form.get("file");
  if (!(file instanceof File)) return responseError("Selecione um arquivo CSV.", 400);
  if (!file.name.toLowerCase().endsWith(".csv") || !ALLOWED_TYPES.has(file.type)) return responseError("O arquivo precisa ter extensão e tipo CSV válidos.", 415);
  if (!file.size || file.size > MAX_FILE_BYTES) return responseError("O CSV deve ter entre 1 byte e 10 MB.", 413);

  let mapping: ColumnMapping;
  try { mapping = JSON.parse(String(form.get("mapping") ?? "")) as ColumnMapping; } catch { return responseError("Mapeamento de colunas inválido.", 400); }
  const processId = String(form.get("processId") ?? "");
  const organizationId = String(form.get("organizationId") ?? "");
  const processName = String(form.get("processName") ?? "").trim();
  const processPackId = String(form.get("processPackId") ?? "generic");
  const processPack = getProcessPack(processPackId);
  if (!processPack) return responseError("Contexto de processo inválido.", 400);
  if (!UUID.test(organizationId)) return responseError("Organização inválida.", 400);
  if (processId && !UUID.test(processId)) return responseError("Processo inválido.", 400);
  if (!processId && (processName.length < 2 || processName.length > 160)) return responseError("Informe um nome de processo entre 2 e 160 caracteres.", 400);

  const parsed = parseCsv(await file.text());
  const serverMappingReview = suggestColumnMappingV2({ headers: parsed.headers, profiles: profileColumns(parsed), processPack });
  const validation = validateAndNormalizeCsv(parsed, mapping);
  if (!validation.events.length) return responseError("O CSV não contém nenhum evento válido.", 422, { validation });

  const [{ data: organization }, { data: membership }] = await Promise.all([
    supabase.from("organizations").select("id,created_by").eq("id", organizationId).maybeSingle(),
    supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!organization || (organization.created_by !== user.id && !IMPORT_ROLES.has(membership?.role ?? ""))) return responseError("Você não tem permissão para importar nesta organização.", 403);

  let selectedProcess: { id: string; name: string };
  if (processId) {
    const { data, error } = await supabase.from("processes").select("id,name").eq("id", processId).eq("organization_id", organizationId).maybeSingle();
    if (error || !data) return responseError("Processo não encontrado nesta organização.", 404);
    selectedProcess = data;
  } else {
    const { data, error } = await supabase.from("processes").insert({ organization_id: organizationId, name: processName, created_by: user.id, status: "ready" }).select("id,name").single();
    if (error) return responseError("Não foi possível criar o processo.", 500);
    selectedProcess = data;
  }

  const datasetId = crypto.randomUUID();
  const filename = safeFilename(file.name);
  const storagePath = `${organizationId}/${selectedProcess.id}/${datasetId}/${filename}`;
  const datasetName = filename.replace(/\.csv$/i, "");
  const { error: datasetError } = await supabase.from("datasets").insert({
    id: datasetId,
    organization_id: organizationId,
    process_id: selectedProcess.id,
    name: datasetName,
    source_type: "csv",
    original_filename: file.name,
    storage_path: storagePath,
    row_count: validation.summary.totalRows,
    case_count: validation.summary.caseCount,
    validation_status: "pending",
    validation_errors: validation.errors as unknown as Json,
    column_mapping: mapping as unknown as Json,
    uploaded_by: user.id,
  });
  if (datasetError) return responseError("Não foi possível registrar o dataset.", 500);

  const failDataset = async (message: string) => {
    await supabase.from("datasets").update({ validation_status: "invalid", validation_errors: [{ message }] }).eq("id", datasetId);
    return responseError(message, 500);
  };

  const { error: uploadError } = await supabase.storage.from("process-datasets").upload(storagePath, file, { contentType: file.type || "text/csv", upsert: false });
  if (uploadError) return failDataset("Não foi possível salvar o CSV no Storage.");

  const records = validation.events.map((event, eventIndex) => ({
    organization_id: organizationId,
    process_id: selectedProcess.id,
    dataset_id: datasetId,
    event_index: eventIndex,
    case_id: event.caseId,
    activity: event.activity,
    event_time: event.timestamp,
    resource: event.resource ?? null,
    metadata: {},
  }));
  for (let start = 0; start < records.length; start += 500) {
    const { error } = await supabase.from("process_events").insert(records.slice(start, start + 500));
    if (error) return failDataset("O CSV foi salvo, mas os eventos não puderam ser persistidos.");
  }

  const analysis = runCoreCycle(validation.events);
  const now = new Date().toISOString();
  const { data: analysisRun, error: analysisError } = await supabase.from("analysis_runs").insert({
    organization_id: organizationId,
    process_id: selectedProcess.id,
    dataset_id: datasetId,
    status: "completed",
    engine_version: "core-v1.1",
    started_at: now,
    completed_at: now,
    summary: { metrics: analysis.metrics, simulation: analysis.simulation, impact: analysis.impact } as unknown as Json,
    created_by: user.id,
  }).select("id").single();
  if (analysisError) return failDataset("Os eventos foram salvos, mas a execução não pôde ser registrada.");

  const relatedWrites = [
    supabase.from("process_models").insert({
      organization_id: organizationId, process_id: selectedProcess.id, dataset_id: datasetId, analysis_run_id: analysisRun.id,
      graph: { nodes: analysis.model.nodes, edges: analysis.model.edges } as unknown as Json,
      metrics: analysis.metrics as unknown as Json, variants: analysis.model.variants as unknown as Json, model_version: "core-v1.1",
    }),
    analysis.bottleneck ? supabase.from("bottlenecks").insert({
      organization_id: organizationId, process_id: selectedProcess.id, analysis_run_id: analysisRun.id, rank: 1,
      activity: analysis.bottleneck.activity, score: analysis.bottleneck.score, severity: analysis.bottleneck.severity,
      avg_wait_seconds: analysis.bottleneck.avgWaitSeconds, affected_cases: analysis.bottleneck.affectedCases,
      rework_rate_pct: analysis.bottleneck.reworkRatePct, evidence: analysis.bottleneck.evidence,
    }) : Promise.resolve({ error: null }),
  ];
  const writeResults = await Promise.all(relatedWrites);
  if (writeResults.some((result) => result.error)) return failDataset("A análise foi executada, mas seu modelo não pôde ser persistido.");

  await Promise.all([
    supabase.from("datasets").update({ validation_status: "valid" }).eq("id", datasetId),
    supabase.from("processes").update({ status: "active" }).eq("id", selectedProcess.id),
  ]);

  return NextResponse.json({
    dataset: { id: datasetId, name: datasetName, storagePath },
    process: selectedProcess,
    validation: validation.summary,
    mappingReview: { processPackId: processPack.id, conflicts: serverMappingReview.conflicts },
    analysis,
  }, { status: 201 });
}
