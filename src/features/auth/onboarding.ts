import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const MAX_ORGANIZATION_NAME = 120;

export function normalizeOrganizationName(value: unknown): string {
  if (typeof value !== "string") return "Minha organização";
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) return "Minha organização";
  return normalized.slice(0, MAX_ORGANIZATION_NAME);
}

export function organizationSlug(name: string, userId: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "") || "workspace";

  const suffix = userId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 10) || "user";
  return `${base}-${suffix}`;
}

export function organizationNameFromUser(user: User, preferredName?: unknown) {
  if (typeof preferredName === "string" && preferredName.trim().length >= 2) {
    return normalizeOrganizationName(preferredName);
  }

  const metadataName = user.user_metadata?.organization_name;
  if (typeof metadataName === "string" && metadataName.trim().length >= 2) {
    return normalizeOrganizationName(metadataName);
  }

  return "Minha organização";
}

export async function ensureInitialOrganization(
  supabase: ServerSupabaseClient,
  user: User,
  preferredName?: unknown,
) {
  const { data: existing, error: existingError } = await supabase
    .from("organizations")
    .select("id,name,slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error("Não foi possível verificar a organização da conta.");
  }

  if (existing) return { organization: existing, created: false };

  const name = organizationNameFromUser(user, preferredName);
  const slug = organizationSlug(name, user.id);

  const { data: created, error: createError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      created_by: user.id,
    })
    .select("id,name,slug")
    .single();

  let organization = created;

  if (createError) {
    // The deterministic slug makes concurrent bootstrap calls converge.
    const { data: raced, error: raceError } = await supabase
      .from("organizations")
      .select("id,name,slug")
      .eq("slug", slug)
      .maybeSingle();

    if (raceError || !raced) {
      throw new Error("Não foi possível criar a organização inicial.");
    }

    organization = raced;
  }

  const { error: membershipError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: organization!.id,
        user_id: user.id,
        role: "owner",
      },
      { onConflict: "organization_id,user_id" },
    );

  if (membershipError) {
    // The creator still owns the organization through organizations.created_by.
    // Fail only when the row is not already present.
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization!.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      throw new Error("A organização foi criada, mas o vínculo de proprietário falhou.");
    }
  }

  return { organization: organization!, created: true };
}
