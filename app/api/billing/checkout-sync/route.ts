import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { isPremiumStatus } from "@/lib/billing/subscription-status";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

function toIsoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("[billing][checkout-sync-api] auth required");
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : null;

  try {
    const stripe = getStripe();
    let subscription: Stripe.Subscription | null = null;

    if (sessionId) {
      console.info("[billing][checkout-sync-api] sync via session id", {
        userId: user.id,
        sessionId,
      });
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      if (session.mode !== "subscription") {
        return NextResponse.json(
          { ok: false, code: "NOT_SUBSCRIPTION" },
          { status: 400 },
        );
      }
      const sessionUserId =
        session.client_reference_id ?? session.metadata?.user_id ?? null;
      if (!sessionUserId || sessionUserId !== user.id) {
        return NextResponse.json({ ok: false, code: "USER_MISMATCH" }, { status: 403 });
      }
      const rawSubscription = session.subscription;
      subscription =
        typeof rawSubscription === "string"
          ? await stripe.subscriptions.retrieve(rawSubscription)
          : rawSubscription;
    } else {
      console.info("[billing][checkout-sync-api] no session id, fallback lookup", {
        userId: user.id,
        email: user.email,
      });
      const customers = await stripe.customers.list({
        email: user.email || undefined,
        limit: 5,
      });
      for (const customer of customers.data) {
        const list = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 10,
        });
        const exact = list.data.find((s) => s.metadata?.user_id === user.id);
        if (exact) {
          subscription = exact;
          break;
        }
        if (!subscription && list.data.length > 0) {
          subscription = list.data[0];
        }
      }
    }

    if (!subscription) {
      console.error("[billing][checkout-sync-api] subscription not found", {
        userId: user.id,
        sessionId,
      });
      return NextResponse.json(
        { ok: false, code: "SUBSCRIPTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const sub = subscription as unknown as {
      id: string;
      status: string;
      customer: string | { id: string } | null;
      canceled_at?: number | null;
      current_period_start?: number;
      current_period_end?: number;
      items: { data?: Array<{ price?: { id?: string } }> };
    };
    const nowIso = new Date().toISOString();
    const nextPlan = isPremiumStatus(sub.status) ? "premium" : "free";
    const stripeCustomerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    const stripePriceId = sub.items.data?.[0]?.price?.id ?? null;

    const supabase = createServiceRoleClient();
    const upsertUser = await supabase.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        plan: nextPlan,
        updated_at: nowIso,
      },
      { onConflict: "id" },
    );
    if (upsertUser.error) {
      console.error("[billing][checkout-sync-api] users upsert failed", {
        userId: user.id,
        error: upsertUser.error,
      });
      return NextResponse.json({ ok: false, code: "DB_USERS" }, { status: 500 });
    }

    const upsertSub = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
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
      console.error("[billing][checkout-sync-api] subscriptions upsert failed", {
        userId: user.id,
        error: upsertSub.error,
      });
      return NextResponse.json({ ok: false, code: "DB_SUBS" }, { status: 500 });
    }

    console.info("[billing][checkout-sync-api] sync success", {
      userId: user.id,
      sessionId,
      subscriptionId: sub.id,
      status: sub.status,
      nextPlan,
    });
    return NextResponse.json({ ok: true, nextPlan, status: sub.status });
  } catch (error) {
    console.error("[billing][checkout-sync-api] fatal sync error", {
      userId: user.id,
      sessionId,
      error,
    });
    return NextResponse.json({ ok: false, code: "STRIPE_ERROR" }, { status: 500 });
  }
}
