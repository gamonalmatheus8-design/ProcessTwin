import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sheetsAccess } from "@/features/google-sheets/access";
import { googleClient, SHEETS_SCOPE } from "@/features/google-sheets/google";
import {
  appOrigin,
  seal,
  stateHash,
  unseal,
  UUID,
} from "@/features/google-sheets/security";
import { sheetsRpc } from "@/features/google-sheets/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const store = await cookies();
  const cookie = store.get("pt-google-state")?.value ?? "";
  store.set("pt-google-state", "", {
    maxAge: 0,
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/connectors/google/callback",
  });
  const [expected, processId] = cookie.split(":");
  const url = new URL(request.url);
  if (
    !expected ||
    !UUID.test(processId ?? "") ||
    url.searchParams.get("state") !== expected
  )
    return Response.json(
      { error: "Autorização inválida ou expirada. Conecte novamente." },
      { status: 400 },
    );
  let destination: URL;
  try {
    destination = new URL(`/processes/${processId}/connectors`, appOrigin());
  } catch {
    return Response.json(
      { error: "Conexão Google indisponível." },
      { status: 503 },
    );
  }
  try {
    const { writer } = await sheetsAccess(processId);
    const encrypted = await sheetsRpc<string>(
      writer,
      "sheets_oauth_state_server",
      { p_process: processId, p_hash: stateHash(expected) },
    );
    const verifier = unseal(encrypted, `state:${processId}:${writer.actorId}`);
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error"))
      throw new Error("Consent denied");
    const google = googleClient();
    const { tokens } = await google.getToken({ code, codeVerifier: verifier });
    if (!tokens.refresh_token || !tokens.access_token)
      throw new Error("Offline consent required");
    const info = await google.getTokenInfo(tokens.access_token);
    if (!info.scopes.includes(SHEETS_SCOPE)) throw new Error("Missing scope");
    await sheetsRpc(writer, "sheets_credential_server", {
      p_process: processId,
      p_cipher: seal(
        tokens.refresh_token,
        `credential:${processId}:${writer.actorId}`,
      ),
    });
    destination.searchParams.set("google", "connected");
  } catch {
    destination.searchParams.set("google", "failed");
  }
  return NextResponse.redirect(destination, {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
