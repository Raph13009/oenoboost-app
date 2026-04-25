"use server";

import { redirect } from "next/navigation";

import { getAppOrigin } from "@/lib/billing/app-url";
import { isPremiumStatus } from "@/lib/billing/subscription-status";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type CreatePremiumCheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "ALREADY_PREMIUM"
        | "ALREADY_SUBSCRIBED"
        | "CONFIG"
        | "STRIPE_ERROR";
    };

type CreateBillingPortalResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code: "AUTH_REQUIRED" | "NOT_PREMIUM" | "NO_CUSTOMER" | "STRIPE_ERROR";
    };

async function getLatestSubscriptionForUser(userId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

function normalizeReturnPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  // Prevent protocol-relative or malformed values.
  if (value.startsWith("//")) return "/";
  return value;
}

export async function createPremiumCheckoutSession(
  returnPath?: string,
): Promise<CreatePremiumCheckoutResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, code: "AUTH_REQUIRED" };
  }
  if (user.plan === "premium") {
    return { ok: false, code: "ALREADY_PREMIUM" };
  }

  const priceId = process.env.STRIPE_PRICE_ID_PREMIUM?.trim();
  if (!priceId) {
    return { ok: false, code: "CONFIG" };
  }

  try {
    const latestSub = await getLatestSubscriptionForUser(user.id);
    if (latestSub?.status && isPremiumStatus(latestSub.status)) {
      return { ok: false, code: "ALREADY_SUBSCRIBED" };
    }

    const stripe = getStripe();
    const origin = getAppOrigin();
    const safeReturnPath = normalizeReturnPath(returnPath);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/profil/checkout-success?return_to=${encodeURIComponent(safeReturnPath)}`,
      cancel_url: `${origin}/profil?checkout=cancel&return_to=${encodeURIComponent(safeReturnPath)}`,
      client_reference_id: user.id,
      customer: latestSub?.stripe_customer_id || undefined,
      customer_email: user.email || undefined,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { ok: false, code: "STRIPE_ERROR" };
    }
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, code: "STRIPE_ERROR" };
  }
}

export async function createBillingPortalSession(): Promise<CreateBillingPortalResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "AUTH_REQUIRED" };
  if (user.plan !== "premium") return { ok: false, code: "NOT_PREMIUM" };

  const latestSub = await getLatestSubscriptionForUser(user.id);
  const customerId = latestSub?.stripe_customer_id;
  if (!customerId) return { ok: false, code: "NO_CUSTOMER" };

  try {
    const stripe = getStripe();
    const origin = getAppOrigin();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profil`,
    });
    if (!portal.url) return { ok: false, code: "STRIPE_ERROR" };
    return { ok: true, url: portal.url };
  } catch {
    return { ok: false, code: "STRIPE_ERROR" };
  }
}

export async function openBillingPortalAction() {
  const result = await createBillingPortalSession();
  if (result.ok) {
    redirect(result.url);
  }
  redirect("/profil");
}

export async function cancelCurrentSubscriptionAction() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const latestSub = await getLatestSubscriptionForUser(user.id);
  const stripeSubscriptionId = latestSub?.stripe_subscription_id;
  if (!stripeSubscriptionId || !latestSub?.status || !isPremiumStatus(latestSub.status)) {
    redirect("/profil");
  }

  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(stripeSubscriptionId);

    const nowIso = new Date().toISOString();
    const supabase = createServiceRoleClient();

    const updateSub = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: nowIso,
        updated_at: nowIso,
      })
      .eq("stripe_subscription_id", stripeSubscriptionId);
    if (updateSub.error) {
      throw new Error(updateSub.error.message);
    }

    const updateUser = await supabase
      .from("users")
      .update({
        plan: "free",
        updated_at: nowIso,
      })
      .eq("id", user.id)
      .is("deleted_at", null);
    if (updateUser.error) {
      throw new Error(updateUser.error.message);
    }

    redirect("/profil?subscription=canceled");
  } catch {
    redirect("/profil?subscription=cancel_error");
  }
}
