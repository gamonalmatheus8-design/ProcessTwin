import { NextResponse } from "next/server";
import { ensureInitialOrganization } from "@/features/auth/onboarding";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Autenticação necessária." },
      { status: 401 },
    );
  }

  let organizationName: unknown;
  try {
    const body = (await request.json()) as { organizationName?: unknown };
    organizationName = body.organizationName;
  } catch {
    organizationName = undefined;
  }

  try {
    const result = await ensureInitialOrganization(
      supabase,
      user,
      organizationName,
    );

    return NextResponse.json({
      organization: result.organization,
      created: result.created,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a conta.",
      },
      { status: 500 },
    );
  }
}
