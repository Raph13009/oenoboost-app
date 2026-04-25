import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId =
          session.client_reference_id ?? session.metadata?.user_id ?? null;
        if (!userId || typeof userId !== "string") break;

        const { error } = await supabase
          .from("users")
          .update({
            plan: "premium",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .is("deleted_at", null);

        if (error) {
          console.error("[stripe webhook] checkout.session.completed users update", error);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id ?? null;
        if (!userId || typeof userId !== "string") break;

        const { error } = await supabase
          .from("users")
          .update({
            plan: "free",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .is("deleted_at", null);

        if (error) {
          console.error("[stripe webhook] customer.subscription.deleted users update", error);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook] handler error", e);
  }

  return NextResponse.json({ received: true });
}
