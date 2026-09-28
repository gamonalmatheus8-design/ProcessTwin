import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, service: "supabase", error: "Missing environment variables" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key },
      cache: "no-store",
    });

    return NextResponse.json(
      { ok: response.ok, service: "supabase", status: response.status },
      { status: response.ok ? 200 : 503 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "supabase", error: "Connection failed" },
      { status: 503 }
    );
  }
}
