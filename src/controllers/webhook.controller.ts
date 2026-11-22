import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { getStripe } from "../config/stripe.js";
import { handleStripeEvent } from "../services/stripeWebhook.service.js";

export const stripeWebhook: RequestHandler = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ success: false, message: "Webhook secret is not configured", code: "WEBHOOK_NOT_CONFIGURED" });
    return;
  }
  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ success: false, message: "Missing signature or raw body", code: "INVALID_WEBHOOK" });
    return;
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe signature verification failed:", error instanceof Error ? error.message : error);
    res.status(400).json({ success: false, message: "Invalid signature", code: "INVALID_SIGNATURE" });
    return;
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error(`Stripe event ${event.type} failed:`, error);
    // A non-2xx makes Stripe retry later, which is what we want for transient failures.
    res.status(500).json({ success: false, message: "Webhook handling failed", code: "WEBHOOK_FAILED" });
    return;
  }
  res.json({ received: true });
};