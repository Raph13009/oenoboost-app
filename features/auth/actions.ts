"use server";

import { AuthApiError, createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import frDict from "@/lib/i18n/dictionaries/fr";
import enDict from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/config";

const schema = process.env.SUPABASE_SCHEMA || "public";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

type AuthError = {
  ok: false;
  error: string;
};

type AuthSuccess = {
  ok: true;
};

type AuthResult = AuthSuccess | AuthError;

function dictForLocale(locale: Locale) {
  return locale === "en" ? enDict : frDict;
}

export async function signUpAction(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  locale: Locale;
}): Promise<AuthResult> {
  const dict = dictForLocale(params.locale);

  const first_name = params.firstName.trim();
  const last_name = params.lastName.trim();
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  try {
    if (!first_name || !last_name || !email || !password) {
      console.log("[auth][signup] validation failed: missing fields");
      return { ok: false, error: dict.auth.requiredFields };
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      console.log("[auth][signup] validation failed: email format");
      return { ok: false, error: dict.auth.requiredFields };
    }

    if (password.length < 6) {
      console.log("[auth][signup] validation failed: password too short", {
        len: password.length,
      });
      return { ok: false, error: dict.auth.passwordTooShort };
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      if (authError instanceof AuthApiError && authError.status === 422) {
        return { ok: false, error: dict.auth.emailInUse };
      }
      return { ok: false, error: dict.auth.genericAuthError };
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      return { ok: false, error: dict.auth.genericAuthError };
    }

    const admin = createAdminClient();
    const { error: profileError } = await admin.from("users").insert({
      id: authUserId,
      email,
      first_name,
      last_name,
      avatar_url: null,
      role: "user",
      plan: "free",
      level: "0",
      xp: 0,
      is_verified: true,
      locale: "fr",
    });

    if (profileError) {
      if (profileError.code === "23505") {
        return { ok: false, error: dict.auth.emailInUse };
      }
      return { ok: false, error: dict.auth.genericAuthError };
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during signup";
    console.error("[auth][signup] fatal error", { message });
    return { ok: false, error: dict.auth.genericAuthError };
  }
}

export async function signInAction(params: {
  email: string;
  password: string;
  locale: Locale;
}): Promise<AuthResult> {
  const dict = dictForLocale(params.locale);

  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (!email || !password) {
    return { ok: false, error: dict.auth.requiredFields };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: dict.auth.invalidCredentials };
  }

  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
