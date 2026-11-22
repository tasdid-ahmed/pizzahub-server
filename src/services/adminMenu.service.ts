import { ObjectId, type Document } from "mongodb";
import { getDb } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeRegex, pageMeta } from "../utils/query.js";
import type { AdminItemsQuery, AdminTransactionsQuery } from "../validators/admin.validators.js";

interface ItemRow {
  _id: ObjectId;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  vendor?: { _id: ObjectId; name?: string; businessName?: string; email?: string };
}

const toItemDto = (row: ItemRow) => ({
  id: row._id.toString(),
  itemName: row.itemName,
  category: row.category,
  description: row.description,
  price: row.price,
  location: row.location,
  images: row.images,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  vendor: {
    id: row.vendor?._id.toString() ?? "",
    name: row.vendor?.businessName?.trim() || row.vendor?.name || "Unknown vendor",
    email: row.vendor?.email ?? "",
  },
});

const vendorJoin: Document[] = [
  { $lookup: { from: "user", localField: "vendorId", foreignField: "_id", as: "vendor" } },
  { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
];

/** Moderation queue: pending items first, then newest. */
export async function listItems(query: AdminItemsQuery) {
  const filter: Document = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.q) {
    const pattern = escapeRegex(query.q);
    filter.$or = [
      { itemName: { $regex: pattern, $options: "i" } },
      { location: { $regex: pattern, $options: "i" } },
    ];
  }

  const [result] = await (await getDb())
    .collection("menuItems")
    .aggregate<{ items: ItemRow[]; total: { count: number }[] }>([
      { $match: filter },
      ...vendorJoin,
      { $addFields: { rank: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
      {
        $facet: {
          items: [
            { $sort: { rank: 1, createdAt: -1, _id: -1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            { $project: { rank: 0, "vendor.image": 0, "vendor.subscriptionPlan": 0 } },
          ],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  const total = result?.total[0]?.count ?? 0;
  return { items: (result?.items ?? []).map(toItemDto), meta: pageMeta(total, query.page, query.limit) };
}

export async function setItemStatus(id: ObjectId, status: "approved" | "rejected" | "inactive") {
  const items = (await getDb()).collection("menuItems");
  const updatedAt = new Date();
  const result = await items.updateOne({ _id: id }, { $set: { status, updatedAt } });
  if (result.matchedCount === 0) throw new ApiError(404, "Menu item not found", "ITEM_NOT_FOUND");
  const [row] = await items
    .aggregate<ItemRow>([{ $match: { _id: id } }, ...vendorJoin])
    .toArray();
  return toItemDto(row as ItemRow);
}

/** Deleting an inappropriate item also cancels its pending and accepted orders. */
export async function deleteItem(id: ObjectId) {
  const db = await getDb();
  const item = await db.collection("menuItems").findOne({ _id: id });
  if (!item) throw new ApiError(404, "Menu item not found", "ITEM_NOT_FOUND");
  await db
    .collection("orders")
    .updateMany({ itemId: id, status: { $in: ["pending", "accepted"] } }, { $set: { status: "cancelled", updatedAt: new Date() } });
  await db.collection("menuItems").deleteOne({ _id: id });
}

export async function listTransactions(query: AdminTransactionsQuery) {
  const filter: Document = {};
  if (query.status) filter.status = query.status;

  const [result] = await (await getDb())
    .collection("transactions")
    .aggregate<{ items: Document[]; total: { count: number }[] }>([
      { $match: filter },
      ...vendorJoin,
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
  const items = (result?.items ?? []).map((row) => ({
    id: String(row._id),
    vendor: {
      id: row.vendor?._id ? String(row.vendor._id) : "",
      name: row.vendor?.businessName?.trim?.() || row.vendor?.name || "Unknown vendor",
      email: row.vendor?.email ?? "",
    },
    plan: row.plan,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripeSessionId ?? null,
    createdAt: row.createdAt,
  }));
  return { items, meta: pageMeta(total, query.page, query.limit) };
}