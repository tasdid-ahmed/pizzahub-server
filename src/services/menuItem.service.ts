import { ObjectId, type Collection } from "mongodb";
import { getDb } from "../config/db.js";
import type { AuthUser } from "../types/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { FREE_PLAN_ITEM_LIMIT, LIVE_STATUSES, type ItemStatus } from "../utils/constants.js";
import type { CreateMenuItemInput, UpdateMenuItemInput } from "../validators/menuItem.validators.js";

export interface MenuItemDoc {
  _id: ObjectId;
  vendorId: ObjectId;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Editing any of these sends the item back to review (decision 7).
const CONTENT_FIELDS = ["itemName", "description", "images", "category"] as const;

async function menuItems(): Promise<Collection<MenuItemDoc>> {
  return (await getDb()).collection<MenuItemDoc>("menuItems");
}

export function toMenuItemDto(doc: MenuItemDoc) {
  const { _id, vendorId, ...rest } = doc;
  return { id: _id.toString(), vendorId: vendorId.toString(), ...rest };
}

/** 404 if it doesn't exist, 403 if it belongs to another vendor. */
async function findOwnedItem(user: AuthUser, id: ObjectId): Promise<MenuItemDoc> {
  const item = await (await menuItems()).findOne({ _id: id });
  if (!item) throw new ApiError(404, "Menu item not found", "ITEM_NOT_FOUND");
  if (!item.vendorId.equals(user.objectId)) {
    throw new ApiError(403, "You can only manage your own menu items", "FORBIDDEN");
  }
  return item;
}

/** Free plan: at most 3 items that are pending or approved. Premium: unlimited. */
async function assertWithinPlanLimit(user: AuthUser) {
  if (user.plan === "premium") return;
  const count = await (await menuItems()).countDocuments({
    vendorId: user.objectId,
    status: { $in: [...LIVE_STATUSES] },
  });
  if (count >= FREE_PLAN_ITEM_LIMIT) {
    throw new ApiError(
      403,
      `The free plan allows up to ${FREE_PLAN_ITEM_LIMIT} active menu items. Upgrade to Premium to add more.`,
      "PLAN_LIMIT_REACHED",
    );
  }
}

export async function listVendorItems(user: AuthUser) {
  const docs = await (await menuItems()).find({ vendorId: user.objectId }).sort({ createdAt: -1 }).toArray();
  return docs.map(toMenuItemDto);
}

export async function getVendorItem(user: AuthUser, id: ObjectId) {
  return toMenuItemDto(await findOwnedItem(user, id));
}

export async function createMenuItem(user: AuthUser, input: CreateMenuItemInput) {
  await assertWithinPlanLimit(user);
  const now = new Date();
  const doc: MenuItemDoc = {
    _id: new ObjectId(),
    vendorId: user.objectId,
    ...input,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await (await menuItems()).insertOne(doc);
  return toMenuItemDto(doc);
}

export async function updateMenuItem(user: AuthUser, id: ObjectId, input: UpdateMenuItemInput) {
  const item = await findOwnedItem(user, id);

  const contentChanged = CONTENT_FIELDS.some(
    (field) => field in input && JSON.stringify(input[field]) !== JSON.stringify(item[field]),
  );

  let status: ItemStatus = item.status;
  if (contentChanged && status !== "pending") {
    // Rejected and inactive items don't count as live, so resubmitting them needs a free slot.
    if (status === "rejected" || status === "inactive") await assertWithinPlanLimit(user);
    status = "pending";
  }

  const changes = { ...input, status, updatedAt: new Date() };
  await (await menuItems()).updateOne({ _id: item._id }, { $set: changes });
  return toMenuItemDto({ ...item, ...changes });
}

export async function setAvailability(user: AuthUser, id: ObjectId, available: boolean) {
  const item = await findOwnedItem(user, id);
  let status: ItemStatus = item.status;

  if (available) {
    if (item.status !== "approved") {
      if (item.status !== "inactive") {
        throw new ApiError(409, "Only items that were approved earlier can be made available", "INVALID_STATUS");
      }
      await assertWithinPlanLimit(user);
      status = "approved";
    }
  } else if (item.status !== "inactive") {
    if (item.status !== "approved") {
      throw new ApiError(409, "Only approved items can be made unavailable", "INVALID_STATUS");
    }
    status = "inactive";
  }

  if (status === item.status) return toMenuItemDto(item);
  const updatedAt = new Date();
  await (await menuItems()).updateOne({ _id: item._id }, { $set: { status, updatedAt } });
  return toMenuItemDto({ ...item, status, updatedAt });
}

export async function deleteMenuItem(user: AuthUser, id: ObjectId) {
  const item = await findOwnedItem(user, id);
  const activeOrders = await (await getDb())
    .collection("orders")
    .countDocuments({ itemId: item._id, status: { $in: ["pending", "accepted"] } });
  if (activeOrders > 0) {
    throw new ApiError(409, "This item has active orders. Resolve them before deleting it.", "ITEM_HAS_ACTIVE_ORDERS");
  }
  await (await menuItems()).deleteOne({ _id: item._id });
}