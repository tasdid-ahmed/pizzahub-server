import { getDb } from "../config/db.js";

let ready: Promise<unknown> | undefined;

/** Transactions collection, with unique indexes that make webhook handling idempotent. */
export async function transactions() {
  const collection = (await getDb()).collection("transactions");
  ready ??= Promise.all([
    collection.createIndex({ stripeSessionId: 1 }, { unique: true, partialFilterExpression: { stripeSessionId: { $type: "string" } } }),
    collection.createIndex({ stripeInvoiceId: 1 }, { unique: true, partialFilterExpression: { stripeInvoiceId: { $type: "string" } } }),
  ]).catch((error) => {
    ready = undefined;
    throw error;
  });
  await ready;
  return collection;
}