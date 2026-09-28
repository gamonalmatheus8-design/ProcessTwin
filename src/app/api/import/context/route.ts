import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const IMPORT_ROLES = new Set(["owner", "admin", "analyst"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });

  const [{ data: organizations, error: organizationsError }, { data: memberships, error: membershipsError }, { data: processes, error: processesError }] = await Promise.all([
    supabase.from("organizations").select("id,name,created_by").order("name"),
    supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id),
    supabase.from("processes").select("id,organization_id,name").order("name"),
  ]);
  if (organizationsError || membershipsError || processesError) {
    return NextResponse.json({ error: "Não foi possível carregar o contexto da organização." }, { status: 500 });
  }

  const roles = new Map((memberships ?? []).map((membership) => [membership.organization_id, membership.role]));
  return NextResponse.json({
    user: { id: user.id, email: user.email ?? null },
    organizations: (organizations ?? []).map((organization) => ({
      id: organization.id,
      name: organization.name,
      canImport: organization.created_by === user.id || IMPORT_ROLES.has(roles.get(organization.id) ?? ""),
    })),
    processes: (processes ?? []).map((process) => ({ id: process.id, organizationId: process.organization_id, name: process.name })),
  });
}
