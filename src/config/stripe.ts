import Stripe from "stripe";
import { env } from "./env.js";
import { ApiError } from "../utils/ApiError.js";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, "Payments are not configured on the server", "PAYMENTS_NOT_CONFIGURED");
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}