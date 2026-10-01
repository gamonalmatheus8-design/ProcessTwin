import "server-only";
import { OAuth2Client } from "google-auth-library";
import { appOrigin, sheetsReady } from "./security";
import {
  boundedJson,
  parseSource,
  sheetRange,
  SheetsError,
  valuesToCsv,
  type SheetSource,
} from "./source";
export const SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
export function googleClient() {
  if (!sheetsReady()) throw new Error("Google Sheets unavailable");
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${appOrigin()}/api/connectors/google/callback`,
    transporterOptions: { timeout: 10000, retry: false },
  });
}
export async function fetchSheet(
  sourceInput: SheetSource,
  refreshToken: string,
  fetcher: typeof fetch = fetch,
) {
  const source = parseSource(sourceInput);
  const google = googleClient();
  google.setCredentials({ refresh_token: refreshToken });
  let access: string;
  try {
    const result = await google.getAccessToken();
    if (!result.token) throw new Error();
    access = result.token;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    throw new SheetsError(
      status === 400 || status === 401 ? "needs_reauth" : "source_temporary",
    );
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values/${encodeURIComponent(sheetRange(source))}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
  // One bounded retry for temporary GET failures. No retries for permission or data errors.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      if (!attempt) continue;
      throw new SheetsError("source_temporary");
    }
    if (response.status === 401) throw new SheetsError("needs_reauth");
    if (response.status === 403 || response.status === 404)
      throw new SheetsError("source_unavailable");
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel();
      if (!attempt) continue;
      throw new SheetsError("source_temporary");
    }
    if (!response.ok) throw new SheetsError("invalid_csv");
    return valuesToCsv((await boundedJson(response)).values);
  }
  throw new SheetsError("source_temporary");
}
