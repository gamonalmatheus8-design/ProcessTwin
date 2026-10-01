import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createSyncWriter } from "@/lib/supabase/sync-writer";
import { UUID } from "./security";
export async function sheetsAccess(processId: string) {
  if (!UUID.test(processId)) throw new Error("invalid_process");
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("unauthorized");
  const { data: process } = await client
    .from("processes")
    .select("id,organization_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) throw new Error("not_found");
  const [{ data: organization }, { data: member }] = await Promise.all([
    client
      .from("organizations")
      .select("created_by")
      .eq("id", process.organization_id)
      .maybeSingle(),
    client
      .from("organization_members")
      .select("role")
      .eq("organization_id", process.organization_id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (
    organization?.created_by !== user.id &&
    !["owner", "admin"].includes(member?.role ?? "")
  )
    throw new Error("forbidden");
  return { client, user, process, writer: createSyncWriter(user.id) };
}
export function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status =
    message === "unauthorized"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "not_found"
          ? 404
          : message === "invalid_process"
            ? 400
            : 503;
  return Response.json(
    {
      error:
        status === 401
          ? "Faça login para continuar."
          : status === 403
            ? "Owner/Admin pode gerenciar esta conexão."
            : status === 404
              ? "Processo não encontrado."
              : "Conexão indisponível. Revise a configuração ou tente novamente.",
    },
    { status },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
