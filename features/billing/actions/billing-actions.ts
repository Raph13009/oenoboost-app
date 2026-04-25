"use server";

import { getAppOrigin } from "@/lib/billing/app-url";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe/server";

export type CreatePremiumCheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "ALREADY_PREMIUM"
        | "CONFIG"
        | "STRIPE_ERROR";
    };

export async function createPremiumCheckoutSession(): Promise<CreatePremiumCheckoutResult> {
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
    const stripe = getStripe();
    const origin = getAppOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/profil?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      client_reference_id: user.id,
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
