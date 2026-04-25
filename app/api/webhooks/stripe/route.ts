import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { isPremiumStatus } from "@/lib/billing/subscription-status";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

type SubscriptionRecordPayload = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  plan: "premium";
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  updated_at: string;
};

function toIsoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function customerIdToString(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function priceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items.data[0];
  return firstItem?.price?.id ?? null;
}

function periodFieldsFromSubscription(subscription: Stripe.Subscription) {
  const sub = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    canceled_at?: number | null;
  };

  return {
    currentPeriodStart: toIsoOrNull(sub.current_period_start),
    currentPeriodEnd: toIsoOrNull(sub.current_period_end),
    canceledAt: toIsoOrNull(sub.canceled_at ?? null),
  };
}

async function resolveUserIdForSubscription(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription,
  preferredUserId?: string | null,
): Promise<string | null> {
  if (preferredUserId) return preferredUserId;

  const fromMetadata = subscription.metadata?.user_id ?? null;
  if (fromMetadata && typeof fromMetadata === "string") return fromMetadata;

  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = customerIdToString(subscription.customer);

  const bySub = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (bySub.data?.user_id) return bySub.data.user_id;

  if (stripeCustomerId) {
    const byCustomer = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byCustomer.data?.user_id) return byCustomer.data.user_id;
  }

  return null;
}

async function persistSubscriptionState(
  supabase: ReturnType<typeof createServiceRoleClient>,
  payload: SubscriptionRecordPayload,
) {
  const nextPlan = isPremiumStatus(payload.status) ? "premium" : "free";
  const nowIso = payload.updated_at;

  console.info("[billing][webhook] persisting subscription state", {
    stripeSubscriptionId: payload.stripe_subscription_id,
    userId: payload.user_id,
    status: payload.status,
    nextPlan,
  });

  const upsertSub = await supabase.from("subscriptions").upsert(payload, {
    onConflict: "stripe_subscription_id",
  });
  if (upsertSub.error) {
    console.error("[billing][webhook] subscriptions upsert error", {
      stripeSubscriptionId: payload.stripe_subscription_id,
      userId: payload.user_id,
      error: upsertSub.error,
    });
    throw new Error(
      `[stripe webhook] subscriptions upsert failed (${payload.stripe_subscription_id}): ${upsertSub.error.message}`,
    );
  }
  console.info("[billing][webhook] subscriptions upsert success", {
    stripeSubscriptionId: payload.stripe_subscription_id,
    userId: payload.user_id,
  });

  const updateUser = await supabase
    .from("users")
    .update({ plan: nextPlan, updated_at: nowIso })
    .eq("id", payload.user_id)
    .is("deleted_at", null);
  if (updateUser.error) {
    console.error("[billing][webhook] users plan update error", {
      userId: payload.user_id,
      nextPlan,
      error: updateUser.error,
    });
    throw new Error(
      `[stripe webhook] users plan update failed (${payload.user_id}): ${updateUser.error.message}`,
    );
  }
  console.info("[billing][webhook] users plan update success", {
    userId: payload.user_id,
    nextPlan,
  });
}

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
  const stripe = getStripe();

  try {
    console.info("[billing][webhook] received event", {
      eventType: event.type,
      eventId: event.id,
      eventObject: event.data.object,
    });
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const rawSubId = session.subscription;
        const stripeSubscriptionId =
          typeof rawSubId === "string" ? rawSubId : rawSubId?.id;
        if (!stripeSubscriptionId) break;

        const fallbackUserId =
          session.client_reference_id ?? session.metadata?.user_id ?? null;
        const subscription = (await stripe.subscriptions.retrieve(
          stripeSubscriptionId,
        )) as unknown as Stripe.Subscription;
        const userId = await resolveUserIdForSubscription(
          supabase,
          subscription,
          typeof fallbackUserId === "string" ? fallbackUserId : null,
        );
        console.info("[billing][webhook] extracted user_id", {
          eventType: event.type,
          eventId: event.id,
          userId,
          fallbackUserId,
        });
        if (!userId) break;
        const period = periodFieldsFromSubscription(subscription);

        const payload: SubscriptionRecordPayload = {
          user_id: userId,
          stripe_customer_id: customerIdToString(subscription.customer),
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceIdFromSubscription(subscription),
          plan: "premium",
          status: subscription.status,
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
          canceled_at: period.canceledAt,
          updated_at: new Date().toISOString(),
        };
        await persistSubscriptionState(supabase, payload);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdForSubscription(supabase, subscription);
        console.info("[billing][webhook] extracted user_id", {
          eventType: event.type,
          eventId: event.id,
          userId,
        });
        if (!userId) break;
        const period = periodFieldsFromSubscription(subscription);

        const payload: SubscriptionRecordPayload = {
          user_id: userId,
          stripe_customer_id: customerIdToString(subscription.customer),
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceIdFromSubscription(subscription),
          plan: "premium",
          status: subscription.status,
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
          canceled_at: period.canceledAt,
          updated_at: new Date().toISOString(),
        };
        await persistSubscriptionState(supabase, payload);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[billing][webhook] handler error", {
      eventType: event.type,
      eventId: event.id,
      error,
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
