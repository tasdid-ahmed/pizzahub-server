import { ObjectId, type Document } from "mongodb";
import { getDb } from "../config/db.js";
import type { AuthUser } from "../types/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { parseDateOnly } from "../utils/dates.js";
import { pageMeta } from "../utils/query.js";
import type { CreateOrderInput, OrdersQuery } from "../validators/order.validators.js";

interface OrderRow {
  _id: ObjectId;
  itemId: ObjectId;
  itemName: string;
  itemImage: string;
  price: number;
  deliveryDate: Date;
  deliveryAddress: string;
  message: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  other?: { _id: ObjectId; name?: string; businessName?: string; email?: string };
}

type Party = "vendor" | "customer";

let indexReady: Promise<unknown> | undefined;

/** Orders collection, with the "one active order per item, customer and date" unique index ensured. */
async function orders() {
  const collection = (await getDb()).collection("orders");
  indexReady ??= collection
    .createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } })
    .catch((error) => {
      indexReady = undefined;
      throw error;
    });
  await indexReady;
  return collection;
}

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

function toOrderDto(row: OrderRow, party?: Party) {
  const other = row.other
    ? {
        id: row.other._id.toString(),
        name: (party === "vendor" ? row.other.businessName?.trim() : "") || row.other.name || "Unknown",
        email: row.other.email ?? "",
      }
    : undefined;
  return {
    id: row._id.toString(),
    itemId: row.itemId.toString(),
    item: { name: row.itemName, image: row.itemImage, price: row.price },
    deliveryDate: row.deliveryDate.toISOString().slice(0, 10),
    deliveryAddress: row.deliveryAddress,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(party && other ? { [party]: other } : {}),
  };
}

async function findOrder(id: ObjectId) {
  const order = await (await orders()).findOne({ _id: id });
  if (!order) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
  return order;
}

export async function createOrder(user: AuthUser, input: CreateOrderInput,  itemId: ObjectId) {
  const db = await getDb();
  const [item] = await db
    .collection("menuItems")
    .aggregate<{ _id: ObjectId; vendorId: ObjectId; itemName: string; price: number; images: string[]; status: string; vendor: { isBlocked?: boolean } }>([
      { $match: { _id: itemId } },
      { $lookup: { from: "user", localField: "vendorId", foreignField: "_id", as: "vendor" } },
      { $unwind: "$vendor" },
    ])
    .toArray();

  // Only approved, active items from non-blocked vendors can be ordered.
  if (!item || item.status !== "approved" || item.vendor.isBlocked === true) {
    throw new ApiError(404, "This item is not available for ordering", "ITEM_UNAVAILABLE");
  }
  if (item.vendorId.equals(user.objectId)) {
    throw new ApiError(403, "You can't order your own menu item", "FORBIDDEN");
  }

  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    itemId: item._id,
    vendorId: item.vendorId,
    customerId: user.objectId,
    deliveryDate: parseDateOnly(input.deliveryDate) as Date,
    deliveryAddress: input.deliveryAddress,
    message: input.message ?? "",
    // Snapshot, so the order stays readable if the item is edited or deleted later.
    itemName: item.itemName,
    itemImage: item.images[0] ?? "",
    price: item.price,
    status: "pending",
    activeKey: `${item._id}:${user.objectId}:${input.deliveryDate}`,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await (await orders()).insertOne(doc);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ApiError(409, "You already have an active order for this item on that delivery date", "DUPLICATE_ORDER");
    }
    throw error;
  }
  return toOrderDto(doc);
}

async function listOrders(match: Document, party: Party, query: OrdersQuery) {
  const filter: Document = { ...match };
  if (query.status) filter.status = query.status;
  const [result] = await (await orders())
    .aggregate<{ items: OrderRow[]; total: { count: number }[] }>([
      { $match: filter },
      { $lookup: { from: "user", localField: party === "vendor" ? "vendorId" : "customerId", foreignField: "_id", as: "other" } },
      { $unwind: { path: "$other", preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          items: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();
  const total = result?.total[0]?.count ?? 0;
  return { items: (result?.items ?? []).map((row) => toOrderDto(row, party)), meta: pageMeta(total, query.page, query.limit) };
}

export const listCustomerOrders = (user: AuthUser, query: OrdersQuery) =>
  listOrders({ customerId: user.objectId }, "vendor", query);

export const listVendorOrders = (user: AuthUser, query: OrdersQuery) =>
  listOrders({ vendorId: user.objectId }, "customer", query);

export async function cancelOrder(user: AuthUser, id: ObjectId) {
  const order = await findOrder(id);
  if (!order.customerId.equals(user.objectId)) {
    throw new ApiError(403, "You can only cancel your own orders", "FORBIDDEN");
  }
  if (order.status !== "pending") {
    throw new ApiError(409, `This order is already ${order.status} and can't be cancelled`, "INVALID_STATUS");
  }
  const updatedAt = new Date();
  const result = await (await orders()).updateOne(
    { _id: id, status: "pending" },
    { $set: { status: "cancelled", updatedAt }, $unset: { activeKey: "" } },
  );
  if (result.matchedCount === 0) throw new ApiError(409, "This order can no longer be cancelled", "INVALID_STATUS");
  return toOrderDto({ ...(order as unknown as OrderRow), status: "cancelled", updatedAt });
}

export async function decideOrder(user: AuthUser, id: ObjectId, status: "accepted" | "rejected") {
  const order = await findOrder(id);
  if (!order.vendorId.equals(user.objectId)) {
    throw new ApiError(403, "You can only manage orders for your own menu items", "FORBIDDEN");
  }
  if (order.status !== "pending") {
    throw new ApiError(409, `This order is already ${order.status}`, "INVALID_STATUS");
  }
  const updatedAt = new Date();
  const update: Document =
    status === "rejected"
      ? { $set: { status, updatedAt }, $unset: { activeKey: "" } } // a rejected order frees the slot
      : { $set: { status, updatedAt } };
  // Atomic: only matches while still pending, so an order can be decided exactly once.
  const result = await (await orders()).updateOne({ _id: id, vendorId: user.objectId, status: "pending" }, update);
  if (result.matchedCount === 0) throw new ApiError(409, "This order was already updated", "INVALID_STATUS");
  return toOrderDto({ ...(order as unknown as OrderRow), status, updatedAt });
}

async function countByStatus(match: Document) {
  const rows = await (await orders())
    .aggregate<{ _id: string; count: number }>([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

export async function getCustomerOverview(user: AuthUser) {
  const counts = await countByStatus({ customerId: user.objectId });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    totalOrders: total,
    pendingOrders: counts.pending ?? 0,
    acceptedOrders: counts.accepted ?? 0,
    rejectedOrders: counts.rejected ?? 0,
    cancelledOrders: counts.cancelled ?? 0,
  };
}

export async function getVendorOverview(user: AuthUser) {
  const items = (await getDb()).collection("menuItems");
  const [totalMenuItems, activeMenuItems, counts] = await Promise.all([
    items.countDocuments({ vendorId: user.objectId }),
    items.countDocuments({ vendorId: user.objectId, status: "approved" }),
    countByStatus({ vendorId: user.objectId }),
  ]);
  return {
    totalMenuItems,
    activeMenuItems,
    pendingOrders: counts.pending ?? 0,
    acceptedOrders: counts.accepted ?? 0,
    rejectedOrders: counts.rejected ?? 0,
    cancelledOrders: counts.cancelled ?? 0,
    plan: user.plan,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };
}