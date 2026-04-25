import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses RLS). Use only on the server for
 * trusted operations (webhooks, admin scripts).
 */
export function createServiceRoleClient() {
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
