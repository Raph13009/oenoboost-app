import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

import type { Locale } from "@/lib/i18n/config";

export type CurrentUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  plan: string;
  level: string;
  locale: Locale;
};

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_SCHEMA || "public";

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select(
      "id, email, first_name, last_name, avatar_url, role, plan, level, is_verified, locale",
    )
    .eq("id", authUser.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return null;
  if (!data) {
    return {
      id: authUser.id,
      email: authUser.email ?? "",
      first_name: (authUser.user_metadata?.first_name as string | undefined) ?? null,
      last_name: (authUser.user_metadata?.last_name as string | undefined) ?? null,
      avatar_url: null,
      role: "user",
      plan: "free",
      level: "beginner",
      locale: "fr",
    };
  }

  return {
    id: data.id,
    email: data.email,
    first_name: data.first_name,
    last_name: data.last_name,
    avatar_url: data.avatar_url,
    role: data.role,
    plan: data.plan,
    level: data.level,
    locale: (data.locale as Locale) || "fr",
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
