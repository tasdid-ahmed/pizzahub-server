import { ObjectId, type Document } from "mongodb";
import { getDb } from "../config/db.js";
import type { AuthUser } from "../types/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeRegex, pageMeta } from "../utils/query.js";
import type { AdminUsersQuery } from "../validators/admin.validators.js";

function toUserDto(doc: Document) {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    email: doc.email ?? "",
    image: doc.image ?? null,
    role: doc.role ?? "customer",
    isBlocked: doc.isBlocked === true,
    businessName: doc.businessName ?? null,
    subscriptionPlan: doc.subscriptionPlan ?? "free",
    subscriptionExpiresAt: doc.subscriptionExpiresAt ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

async function countBy(collection: string, match: Document, field: string) {
  const rows = await (await getDb())
    .collection(collection)
    .aggregate<{ _id: string; count: number }>([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

export async function getOverview() {
  const db = await getDb();
  const users = db.collection("user");
  const items = db.collection("menuItems");
  const [totalUsers, totalVendors, totalCustomers, totalMenuItems, pendingMenuItems, totalTransactions, itemsByStatus] =
    await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ role: "vendor" }),
      users.countDocuments({ role: "customer" }),
      items.countDocuments({}),
      items.countDocuments({ status: "pending" }),
      db.collection("transactions").countDocuments({}),
      countBy("menuItems", {}, "status"),
    ]);
  return { totalUsers, totalVendors, totalCustomers, totalMenuItems, pendingMenuItems, totalTransactions, itemsByStatus };
}

export async function listUsers(query: AdminUsersQuery) {
  const filter: Document = {};
  if (query.role) filter.role = query.role;
  if (query.q) {
    const pattern = escapeRegex(query.q);
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
    ];
  }
  const users = (await getDb()).collection("user");
  const [docs, total] = await Promise.all([
    users
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .toArray(),
    users.countDocuments(filter),
  ]);
  return { items: docs.map(toUserDto), meta: pageMeta(total, query.page, query.limit) };
}

export async function getUserDetails(id: ObjectId) {
  const doc = await (await getDb()).collection("user").findOne({ _id: id });
  if (!doc) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  const user = toUserDto(doc);
  const stats =
    user.role === "vendor"
      ? await countBy("menuItems", { vendorId: id }, "status")
      : user.role === "customer"
        ? await countBy("orders", { customerId: id }, "status")
        : {};
  return { ...user, stats };
}

export async function setUserBlocked(actor: AuthUser, id: ObjectId, blocked: boolean) {
  if (id.equals(actor.objectId)) {
    throw new ApiError(400, "You can't block your own account", "INVALID_ACTION");
  }
  const users = (await getDb()).collection("user");
  const target = await users.findOne({ _id: id });
  if (!target) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  if (target.role === "admin") throw new ApiError(403, "Admin accounts can't be blocked", "FORBIDDEN");
  await users.updateOne({ _id: id }, { $set: { isBlocked: blocked, updatedAt: new Date() } });
  return toUserDto({ ...target, isBlocked: blocked });
}