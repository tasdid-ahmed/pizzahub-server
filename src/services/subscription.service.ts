import { getDb } from "../config/db.js";
import { env } from "../config/env.js";
import { getStripe } from "../config/stripe.js";
import type { AuthUser } from "../types/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { FREE_PLAN_ITEM_LIMIT, PREMIUM_CURRENCY, PREMIUM_PRICE_CENTS } from "../utils/constants.js";
import { transactions } from "./transaction.store.js";

export async function getSubscriptionStatus(user: AuthUser) {
  const doc = await (await getDb())
    .collection("user")
    .findOne({ _id: user.objectId }, { projection: { stripeSubscriptionId: 1, subscriptionCancelAtPeriodEnd: 1 } });
  const premium = user.plan === "premium";
  return {
    plan: user.plan,
    expiresAt: user.subscriptionExpiresAt,
    cancelAtPeriodEnd: premium && doc?.subscriptionCancelAtPeriodEnd === true,
    canCancel: premium && Boolean(doc?.stripeSubscriptionId),
    priceUsd: PREMIUM_PRICE_CENTS / 100,
    freeLimit: FREE_PLAN_ITEM_LIMIT,
  };
}

export async function createCheckoutSession(user: AuthUser) {
  if (user.plan === "premium") {
    throw new ApiError(409, "You already have an active Premium subscription", "ALREADY_PREMIUM");
  }
  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PREMIUM_CURRENCY,
            unit_amount: PREMIUM_PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: {
              name: "PizzaHub Premium",
              description: "Unlimited menu items, Premium badge and featured placement",
            },
          },
        },
      ],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { vendorId: user.id },
      subscription_data: { metadata: { vendorId: user.id } },
      success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/payment/cancel`,
    });
  } catch (error) {
    console.error("Stripe checkout session failed:", error);
    throw new ApiError(502, "We couldn't start the payment. Please try again.", "CHECKOUT_FAILED");
  }
  if (!session.url) throw new ApiError(502, "We couldn't start the payment. Please try again.", "CHECKOUT_FAILED");

  // Recorded as pending. Only the verified webhook can mark it paid.
  await (await transactions()).insertOne({
    vendorId: user.objectId,
    plan: "premium",
    amount: PREMIUM_PRICE_CENTS / 100,
    currency: PREMIUM_CURRENCY,
    stripeSessionId: session.id,
    stripeSubscriptionId: null,
    status: "pending",
    createdAt: new Date(),
  });

  return { url: session.url };
}

/** Cancels at the end of the paid period. Premium stays active until then. */
export async function cancelSubscription(user: AuthUser) {
  const users = (await getDb()).collection("user");
  const doc = await users.findOne({ _id: user.objectId }, { projection: { stripeSubscriptionId: 1 } });
  const subscriptionId = doc?.stripeSubscriptionId as string | undefined;
  if (user.plan !== "premium" || !subscriptionId) {
    throw new ApiError(409, "You don't have an active subscription to cancel", "NO_SUBSCRIPTION");
  }
  try {
    await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  } catch (error) {
    console.error("Stripe cancellation failed:", error);
    throw new ApiError(502, "We couldn't cancel the subscription. Please try again.", "CANCEL_FAILED");
  }
  await users.updateOne({ _id: user.objectId }, { $set: { subscriptionCancelAtPeriodEnd: true, updatedAt: new Date() } });
  return getSubscriptionStatus(user);
}