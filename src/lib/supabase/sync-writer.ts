import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SyncWriter } from "@/features/sync/service";
import { SUPABASE_URL } from "./config";

// A dedicated client: never reuse SSR cookies or a user Authorization header here.
// The actor must come from getUser(), after route-level process/role authorization.
export function createSyncWriter(actorId: string): SyncWriter {
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Sync writer unavailable");
  return {
    actorId,
    client: createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
}
