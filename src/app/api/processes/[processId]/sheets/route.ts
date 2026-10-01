import { randomBytes } from "node:crypto";
import Papa from "papaparse";
import { CodeChallengeMethod } from "google-auth-library";
import { cookies } from "next/headers";
import {
  sheetsAccess,
  accessError,
  sameOrigin,
} from "@/features/google-sheets/access";
import { googleClient } from "@/features/google-sheets/google";
import {
  seal,
  stateHash,
  UUID,
  sheetsReady,
} from "@/features/google-sheets/security";
import {
  analyzeSheetRun,
  loadSheetConnector,
  sheetPreview,
  sheetsRpc,
  synchronizeSheet,
} from "@/features/google-sheets/service";
import { parseSource, SheetsError } from "@/features/google-sheets/source";
import { SHEETS_SCOPE } from "@/features/google-sheets/google";
import { parseCsv } from "@/features/import/parser";
import { getProcessPack } from "@/features/import/process-packs";
import {
  parseCanonicalMapping,
  parseIdentityConfig,
  prepareRecurringCsv,
  sourceSchemaHash,
  SyncValidationError,
} from "@/features/sync/recurring-csv";
import type { SyncRun } from "@/features/sync/types";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ processId: string }> },
) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Formulário inválido." }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > 16000)
    return Response.json(
      { error: "Formulário grande demais." },
      { status: 413 },
    );
  const { processId } = await context.params;
  try {
    const { writer } = await sheetsAccess(processId);
    if (!sheetsReady())
      return Response.json(
        {
          error:
            "A conexão Google ainda precisa ser configurada pelo administrador.",
        },
        { status: 503 },
      );
    const text = await request.text();
    if (Buffer.byteLength(text) > 16000)
      return Response.json(
        { error: "Formulário grande demais." },
        { status: 413 },
      );
    const body = JSON.parse(text) as Record<string, unknown>;
    const action = body.action;
    if (action === "status") {
      const credential = await sheetsRpc<{ id: string } | null>(
        writer,
        "sheets_credential_server",
        { p_process: processId },
      );
      return Response.json(
        { connected: Boolean(credential) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (action === "authorize") {
      const state = randomBytes(32).toString("base64url");
      const google = googleClient();
      const pkce = await google.generateCodeVerifierAsync();
      await sheetsRpc(writer, "sheets_oauth_state_server", {
        p_process: processId,
        p_hash: stateHash(state),
        p_cipher: seal(
          pkce.codeVerifier,
          `state:${processId}:${writer.actorId}`,
        ),
      });
      (await cookies()).set("pt-google-state", `${state}:${processId}`, {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "lax",
        maxAge: 600,
        path: "/api/connectors/google/callback",
      });
      return Response.json(
        {
          url: google.generateAuthUrl({
            state,
            scope: [SHEETS_SCOPE],
            access_type: "offline",
            prompt: "consent",
            code_challenge_method: CodeChallengeMethod.S256,
            code_challenge: pkce.codeChallenge,
          }),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (action === "disconnect") {
      await sheetsRpc(writer, "sheets_credential_server", {
        p_process: processId,
        p_remove: true,
      });
      return Response.json({ disconnected: true });
    }
    const connectorId =
      typeof body.connectorId === "string" ? body.connectorId : "";
    if (connectorId && !UUID.test(connectorId))
      return Response.json({ error: "Conector inválido." }, { status: 400 });
    if (action === "sync")
      return Response.json(
        await synchronizeSheet(writer, processId, connectorId),
      );
    if (action === "analysis") {
      if (!UUID.test(String(body.runId)))
        return Response.json({ error: "Execução inválida." }, { status: 400 });
      const { data: run } = await writer.client
        .from("sync_runs")
        .select("*")
        .eq("id", body.runId)
        .eq("process_id", processId)
        .maybeSingle();
      if (!run)
        return Response.json(
          { error: "Execução não encontrada." },
          { status: 404 },
        );
      await loadSheetConnector(writer, processId, run.connector_id);
      return Response.json({
        run: await analyzeSheetRun(writer, run as SyncRun),
      });
    }
    if (action === "pause") {
      await loadSheetConnector(writer, processId, connectorId);
      await sheetsRpc(writer, "sheets_control_server", {
        p_connector: connectorId,
        p_action: "pause",
      });
      return Response.json({ paused: true });
    }
    if (!["preview", "create", "review"].includes(String(action)))
      return Response.json({ error: "Ação inválida." }, { status: 400 });
    const saved = connectorId
      ? (await loadSheetConnector(writer, processId, connectorId)).connector
      : null;
    const source = parseSource(saved?.configuration ?? body.source);
    const contents = await sheetPreview(writer, processId, source);
    const parsed = parseCsv(contents);
    const hash = sourceSchemaHash(parsed.headers);
    if (action === "preview") {
      const { data: mapping } = saved
        ? await writer.client
            .from("connector_mappings")
            .select("canonical_mapping,identity_config")
            .eq("connector_id", saved.id)
            .eq("active", true)
            .single()
        : { data: null };
      return Response.json(
        {
          sampleCsv: Papa.unparse({
            fields: parsed.headers,
            data: parsed.rows
              .slice(0, 50)
              .map((row) => parsed.headers.map((header) => row.values[header])),
          }),
          total: parsed.rows.length,
          schemaHash: hash,
          savedMapping: mapping,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.confirmed !== true || body.schemaHash !== hash)
      return Response.json(
        {
          error:
            "A estrutura mudou ou falta confirmação. Carregue a amostra e revise novamente.",
        },
        { status: 409 },
      );
    const mapping = parseCanonicalMapping(body.mapping);
    const { data: frozen } = saved
      ? await writer.client
          .from("connector_mappings")
          .select("identity_config")
          .eq("connector_id", saved.id)
          .eq("active", true)
          .single()
      : { data: null };
    const identity = parseIdentityConfig(
      frozen?.identity_config ?? body.identity,
    );
    if (identity.strategy !== "source_id")
      return Response.json(
        {
          error:
            "Escolha uma coluna de ID estável para os eventos da planilha.",
        },
        { status: 422 },
      );
    const batch = prepareRecurringCsv(contents, mapping, identity, false);
    if (action === "review") {
      if (!saved)
        return Response.json({ error: "Conector inválido." }, { status: 400 });
      await sheetsRpc(writer, "sheets_control_server", {
        p_connector: saved.id,
        p_action: "review",
        p_mapping: mapping,
        p_schema: batch.schemaHash,
      });
      return Response.json(await synchronizeSheet(writer, processId, saved.id));
    }
    if (saved)
      return Response.json(
        { error: "Configuração inválida." },
        { status: 400 },
      );
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const pack =
      typeof body.processPackId === "string" ? body.processPackId : "generic";
    if (
      name.length < 2 ||
      name.length > 160 ||
      !getProcessPack(pack) ||
      ![null, 1440].includes(body.schedule as null | number)
    )
      return Response.json(
        { error: "Revise o nome, contexto e frequência." },
        { status: 400 },
      );
    const created = await sheetsRpc<{ connectorId: string }>(
      writer,
      "sheets_create_server",
      {
        p_config: { ...source, range: "bounded-v1" },
        p_schedule: body.schedule,
        p_process: processId,
        p_name: name,
        p_pack: pack,
        p_mapping: mapping,
        p_identity: identity,
        p_schema_hash: batch.schemaHash,
      },
    );
    return Response.json(
      await synchronizeSheet(writer, processId, created.connectorId),
    );
  } catch (error) {
    if (error instanceof SyncValidationError || error instanceof SheetsError)
      return Response.json(
        {
          error:
            error instanceof SyncValidationError
              ? error.message
              : error.code === "needs_reauth"
                ? "Conecte sua conta Google para continuar."
                : error.code === "source_unavailable"
                  ? "Revise a planilha, a aba e o acesso da sua conta."
                  : "Não foi possível ler a planilha. Use até 20.000 eventos e 64 colunas.",
        },
        { status: 422 },
      );
    return accessError(error);
  }
}
