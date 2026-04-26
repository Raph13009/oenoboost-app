import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

function normalizeReturnPath(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

function toIsoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const session_id = sessionId;
  const returnTo = normalizeReturnPath(request.nextUrl.searchParams.get("return_to"));
  console.log("[billing][checkout-finalize] called", session_id);
  console.info("[billing][finalize] request received", {
    sessionId,
    returnTo,
  });

  // Capture any Supabase auth cookies refreshed during this request so we
  // can forward them on our manual redirect response. Without this, when the
  // user comes back from Stripe with an expired access_token, the refreshed
  // cookies set by the SSR client are dropped by NextResponse.redirect(...)
  // and the next page (/profil) sees an unauthenticated user → /login.
  const refreshedCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => refreshedCookies.push(c));
        },
      },
    },
  );
  // Trigger token refresh if needed; we don't actually need the user object here.
  await supabaseAuth.auth.getUser();
  console.info("[billing][finalize] supabase session refreshed", {
    sessionId,
    refreshedCookieCount: refreshedCookies.length,
  });

  const buildRedirect = (params: Record<string, string>) => {
    const url = new URL("/profil/checkout-success", request.url);
    url.searchParams.set("return_to", returnTo);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const response = NextResponse.redirect(url);
    for (const { name, value, options } of refreshedCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  };

  if (!sessionId) {
    console.error("[billing][finalize] missing session_id");
    return buildRedirect({ sync_error: "MISSING_SESSION_ID" });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    console.info("[billing][finalize] stripe session retrieved", {
      sessionId,
      sessionObject: session,
    });

    if (session.mode !== "subscription") {
      console.error("[billing][finalize] session is not subscription", {
        sessionId,
        mode: session.mode,
      });
      return buildRedirect({ sync_error: "NOT_SUBSCRIPTION" });
    }

    const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
    console.info("[billing][finalize] extracted user_id", {
      sessionId,
      userId,
      clientReferenceId: session.client_reference_id ?? null,
      metadataUserId: session.metadata?.user_id ?? null,
    });
    if (!userId || typeof userId !== "string") {
      console.error("[billing][finalize] missing user_id in session", {
        sessionId,
      });
      return buildRedirect({ sync_error: "MISSING_USER_ID" });
    }

    const rawSub = session.subscription;
    const subscription =
      typeof rawSub === "string"
        ? await stripe.subscriptions.retrieve(rawSub)
        : rawSub;

    const sub = (subscription ?? null) as
      | null
      | {
          id: string;
          status: string;
          customer: string | { id: string } | null;
          canceled_at?: number | null;
          current_period_start?: number;
          current_period_end?: number;
          items: { data?: Array<{ price?: { id?: string } }> };
        };

    const nowIso = new Date().toISOString();
    const supabase = createServiceRoleClient();

    const upsertUser = await supabase.from("users").upsert(
      {
        id: userId,
        email: session.customer_details?.email ?? null,
        plan: "premium",
        updated_at: nowIso,
      },
      { onConflict: "id" },
    );
    if (upsertUser.error) {
      console.error("[billing][finalize] users upsert failed", {
        sessionId,
        userId,
        error: upsertUser.error,
      });
      return buildRedirect({ sync_error: "DB_USERS" });
    }
    console.info("[billing][finalize] users upsert success", {
      sessionId,
      userId,
      plan: "premium",
    });

    if (sub) {
      const stripeCustomerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      const stripePriceId = sub.items.data?.[0]?.price?.id ?? null;

      const upsertSub = await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: sub.id,
          stripe_price_id: stripePriceId,
          plan: "premium",
          status: sub.status,
          current_period_start: toIsoOrNull(sub.current_period_start),
          current_period_end: toIsoOrNull(sub.current_period_end),
          canceled_at: toIsoOrNull(sub.canceled_at ?? null),
          updated_at: nowIso,
        },
        { onConflict: "stripe_subscription_id" },
      );
      if (upsertSub.error) {
        console.error("[billing][finalize] subscriptions upsert failed", {
          sessionId,
          userId,
          error: upsertSub.error,
        });
      } else {
        console.info("[billing][finalize] subscriptions upsert success", {
          sessionId,
          userId,
          stripeSubscriptionId: sub.id,
          status: sub.status,
        });
      }
    } else {
      console.warn("[billing][finalize] no subscription object found", {
        sessionId,
        userId,
      });
    }

    console.info("[billing][finalize] premium sync success", {
      sessionId,
      userId,
      status: sub?.status ?? null,
    });

    return buildRedirect({ synced: "1" });
  } catch (error) {
    console.error("[billing][finalize] fatal error", {
      sessionId,
      error,
    });
    return buildRedirect({ sync_error: "STRIPE_ERROR" });
  }
}
