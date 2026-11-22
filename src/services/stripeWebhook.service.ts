import type Stripe from "stripe";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { getStripe } from "../config/stripe.js";
import { FREE_PLAN_ITEM_LIMIT, PREMIUM_CURRENCY, PREMIUM_PRICE_CENTS } from "../utils/constants.js";
import { transactions } from "./transaction.store.js";

const idOf = (value: string | { id: string } | null | undefined) =>
  value ? (typeof value === "string" ? value : value.id) : null;

/** Period end moved from the subscription to its items in API version 2025-03-31. Read both. */
function periodEnd(subscription: Stripe.Subscription): Date {
  const loose = subscription as unknown as {
    current_period_end?: number;
    items?: { data?: { current_period_end?: number }[] };
  };
  const seconds = loose.items?.data?.[0]?.current_period_end ?? loose.current_period_end;
  if (!seconds) throw new Error(`Subscription ${subscription.id} has no period end`);
  return new Date(seconds * 1000);
}

/** The invoice's subscription ID moved under invoice.parent in the same version. Read both. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const loose = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } } | null;
  };
  return idOf(loose.parent?.subscription_details?.subscription ?? loose.subscription);
}

async function activate(vendorId: ObjectId, subscription: Stripe.Subscription) {
  await (await getDb()).collection("user").updateOne(
    { _id: vendorId, role: "vendor" },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: periodEnd(subscription),
        stripeCustomerId: idOf(subscription.customer),
        stripeSubscriptionId: subscription.id,
        subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        updatedAt: new Date(),
      },
    },
  );
}

/** Free plan allows 3 live items. Keep the 3 oldest and make extra approved items inactive (never deleted). */
async function downgradeMenuItems(vendorId: ObjectId) {
  const items = (await getDb()).collection("menuItems");
  const live = await items
    .find({ vendorId, status: { $in: ["pending", "approved"] } })
    .sort({ createdAt: 1, _id: 1 })
    .project<{ _id: ObjectId; status: string }>({ _id: 1, status: 1 })
    .toArray();
  const overflow = live
    .slice(FREE_PLAN_ITEM_LIMIT)
    .filter((item) => item.status === "approved")
    .map((item) => item._id);
  if (overflow.length > 0) {
    await items.updateMany({ _id: { $in: overflow } }, { $set: { status: "inactive", updatedAt: new Date() } });
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || session.payment_status === "unpaid") return;
  const vendorText = session.client_reference_id ?? session.metadata?.vendorId;
  const subscriptionId = idOf(session.subscription);
  if (!vendorText || !ObjectId.isValid(vendorText) || !subscriptionId) {
    console.warn("Ignoring checkout.session.completed without vendor or subscription", session.id);
    return;
  }
  const vendorId = new ObjectId(vendorText);
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await activate(vendorId, subscription);

  await (await transactions()).updateOne(
    { stripeSessionId: session.id },
    {
      $set: {
        status: "paid",
        stripeSubscriptionId: subscriptionId,
        amount: (session.amount_total ?? PREMIUM_PRICE_CENTS) / 100,
        currency: session.currency ?? PREMIUM_CURRENCY,
      },
      $setOnInsert: { vendorId, plan: "premium", createdAt: new Date() },
    },
    { upsert: true },
  );
}

async function onCheckoutExpired(session: Stripe.Checkout.Session) {
  await (await transactions()).updateOne({ stripeSessionId: session.id, status: "pending" }, { $set: { status: "failed" } });
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const vendor = await (await getDb()).collection("user").findOne({ stripeSubscriptionId: subscriptionId });
  if (!vendor) return; // the first invoice can arrive before checkout.session.completed, which activates

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await activate(vendor._id, subscription);

  if (invoice.billing_reason === "subscription_cycle" && invoice.id) {
    await (await transactions()).updateOne(
      { stripeInvoiceId: invoice.id },
      {
        $set: { status: "paid", amount: (invoice.amount_paid ?? 0) / 100, currency: invoice.currency ?? PREMIUM_CURRENCY },
        $setOnInsert: { vendorId: vendor._id, plan: "premium", stripeSessionId: null, stripeSubscriptionId: subscriptionId, createdAt: new Date() },
      },
      { upsert: true },
    );
  }
}

async function onInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || invoice.billing_reason !== "subscription_cycle" || !invoice.id) return;
  const vendor = await (await getDb()).collection("user").findOne({ stripeSubscriptionId: subscriptionId });
  if (!vendor) return;
  await (await transactions()).updateOne(
    { stripeInvoiceId: invoice.id },
    {
      $set: { status: "failed", amount: (invoice.amount_due ?? 0) / 100, currency: invoice.currency ?? PREMIUM_CURRENCY },
      $setOnInsert: { vendorId: vendor._id, plan: "premium", stripeSessionId: null, stripeSubscriptionId: subscriptionId, createdAt: new Date() },
    },
    { upsert: true },
  );
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const users = (await getDb()).collection("user");
  const vendor =
    (await users.findOne({ stripeSubscriptionId: subscription.id })) ??
    (subscription.metadata?.vendorId && ObjectId.isValid(subscription.metadata.vendorId)
      ? await users.findOne({ _id: new ObjectId(subscription.metadata.vendorId) })
      : null);
  if (!vendor) return;

  await users.updateOne(
    { _id: vendor._id },
    {
      $set: { subscriptionPlan: "free", subscriptionExpiresAt: new Date(), subscriptionCancelAtPeriodEnd: false, updatedAt: new Date() },
      $unset: { stripeSubscriptionId: "" },
    },
  );
  await downgradeMenuItems(vendor._id);
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return onCheckoutCompleted(event.data.object);
    case "checkout.session.expired":
      return onCheckoutExpired(event.data.object);
    case "invoice.paid":
      return onInvoicePaid(event.data.object);
    case "invoice.payment_failed":
      return onInvoiceFailed(event.data.object);
    case "customer.subscription.deleted":
      return onSubscriptionDeleted(event.data.object);
    default:
      return; // other events are acknowledged and ignored
  }
}