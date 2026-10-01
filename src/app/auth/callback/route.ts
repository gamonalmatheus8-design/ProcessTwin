import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ensureInitialOrganization } from "@/features/auth/onboarding";
import { safeAuthNext } from "@/features/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeAuthNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  let authError: Error | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    authError = error;
  } else {
    return NextResponse.redirect(
      new URL("/auth?error=invalid_confirmation", url.origin),
    );
  }

  if (authError) {
    return NextResponse.redirect(
      new URL("/auth?error=confirmation_failed", url.origin),
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      new URL("/auth?error=session_failed", url.origin),
    );
  }

  try {
    await ensureInitialOrganization(supabase, user);
  } catch {
    return NextResponse.redirect(
      new URL("/auth?error=onboarding_failed", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
