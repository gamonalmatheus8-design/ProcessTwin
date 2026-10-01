import { NextResponse } from "next/server";
import { getProcessPack } from "@/features/import/process-packs";
import { parseCanonicalMapping, parseIdentityConfig, prepareRecurringCsv, SyncValidationError } from "@/features/sync/recurring-csv";
import { analyzeSyncRun, synchronizeRecurringCsv, syncMessage } from "@/features/sync/service";
import type { FrozenMapping, SyncRun } from "@/features/sync/types";
import { createClient } from "@/lib/supabase/server";
import { createSyncWriter } from "@/lib/supabase/sync-writer";

export const runtime = "nodejs";
export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request, context: { params: Promise<{ processId: string }> }) {
  const { processId } = await context.params;
  if (!UUID.test(processId)) return fail("Processo inválido.", 400);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("Origem inválida.", 403);
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return fail("Envie um formulário com o CSV.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 4.4 * 1024 * 1024) return fail("Envie um CSV de até 4 MB.", 413);
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return fail("Autenticação necessária.", 401);
  const { data: process } = await client.from("processes").select("id,organization_id").eq("id", processId).maybeSingle();
  if (!process) return fail("Processo não encontrado.", 404);
  const [{ data: organization }, { data: member }] = await Promise.all([
    client.from("organizations").select("created_by").eq("id", process.organization_id).maybeSingle(),
    client.from("organization_members").select("role").eq("organization_id", process.organization_id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (organization?.created_by !== user.id && !["owner", "admin"].includes(member?.role ?? "")) return fail("Owner/Admin pode configurar e sincronizar conectores.", 403);
  let writer;
  try { writer = createSyncWriter(user.id); }
  catch { return fail("A sincronização está temporariamente indisponível. Tente novamente mais tarde.", 503); }
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Formulário inválido.", 400); }
  if (form.get("action") === "analysis") {
    const runId = String(form.get("runId") ?? "");
    if (!UUID.test(runId)) return fail("Sincronização inválida.", 400);
    const { data: run } = await client.from("sync_runs").select("*").eq("id", runId).eq("process_id", processId).maybeSingle();
    if (!run) return fail("Sincronização não encontrada.", 404);
    try {
      const result = await analyzeSyncRun(client, run as SyncRun, writer);
      return NextResponse.json({ connectorId: result.connector_id, datasetId: result.dataset_id, run: result, message: syncMessage(result), analysisExecuted: result.analysis_status === "succeeded" });
    } catch { return fail("Não foi possível executar a análise. Os dados continuam salvos.", 500); }
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || !["text/csv", "application/vnd.ms-excel", "text/plain", ""].includes(file.type)) return fail("Selecione um arquivo CSV.", 415);
  if (!file.size || file.size > 4 * 1024 * 1024) return fail("Envie um CSV entre 1 byte e 4 MB.", 413);
  try {
    let connectorId = String(form.get("connectorId") ?? "");
    if (!connectorId) {
      const name = String(form.get("name") ?? "").trim();
      const pack = String(form.get("processPackId") ?? "generic");
      if (name.length < 2 || name.length > 160 || !getProcessPack(pack)) return fail("Revise o nome e o Process Pack.", 400);
      const canonical = parseCanonicalMapping(JSON.parse(String(form.get("mapping") ?? "")));
      const identity = parseIdentityConfig(JSON.parse(String(form.get("identity") ?? "")));
      const prepared = prepareRecurringCsv(await file.text(), canonical, identity, false);
      const { data, error } = await client.rpc("recurring_csv_create", { p_process: processId, p_name: name, p_pack: pack,
        p_mapping: canonical, p_identity: identity, p_schema_hash: prepared.schemaHash });
      if (error || !data) return fail("Não foi possível criar o conector.", 500);
      connectorId = data.connectorId;
    }
    if (!UUID.test(connectorId)) return fail("Conector inválido.", 400);
    const { data: connector } = await client.from("connectors").select("id").eq("id", connectorId).eq("process_id", processId).eq("organization_id", process.organization_id).eq("type", "recurring_csv").maybeSingle();
    if (!connector) return fail("Conector não encontrado neste processo.", 404);
    const { data: saved } = await client.from("connector_mappings").select("canonical_mapping,identity_config,source_schema_hash").eq("connector_id", connectorId).eq("active", true).eq("version", 1).single();
    if (!saved) return fail("Mapeamento do conector indisponível.", 409);
    const mapping: FrozenMapping = { canonical_mapping: parseCanonicalMapping(saved.canonical_mapping), identity_config: parseIdentityConfig(saved.identity_config), source_schema_hash: saved.source_schema_hash };
    const result = await synchronizeRecurringCsv({ client, connectorId, file, mapping, writer });
    return NextResponse.json(result, { status: result.run.status === "failed" ? 422 : 200 });
  } catch (error) {
    return fail(error instanceof SyncValidationError ? error.message : "Não foi possível concluir a sincronização. Verifique o histórico antes de tentar novamente.", error instanceof SyncValidationError ? 422 : 500);
  }
}
