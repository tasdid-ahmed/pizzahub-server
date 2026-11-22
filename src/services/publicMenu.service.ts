import { ObjectId, type Document } from "mongodb";
import { getDb } from "../config/db.js";
import type { AuthUser } from "../types/auth.js";
import { ApiError } from "../utils/ApiError.js";
import type { ListMenuQuery } from "../validators/publicMenu.validators.js";

interface PublicRow {
  _id: ObjectId;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: string;
  createdAt: Date;
  isPremium: boolean;
  vendor: { _id: ObjectId; name?: string; businessName?: string; image?: string | null; isBlocked?: boolean };
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Join the vendor and compute Premium from the plan AND its expiry date.
const vendorJoin: Document[] = [
  { $lookup: { from: "user", localField: "vendorId", foreignField: "_id", as: "vendor" } },
  { $unwind: "$vendor" },
  {
    $addFields: {
      isPremium: {
        $and: [
          { $eq: ["$vendor.subscriptionPlan", "premium"] },
          { $gt: ["$vendor.subscriptionExpiresAt", "$$NOW"] },
        ],
      },
    },
  },
];
const hideBlockedVendors: Document = { $match: { "vendor.isBlocked": { $ne: true } } };

const projection: Document = {
  itemName: 1,
  category: 1,
  description: 1,
  price: 1,
  location: 1,
  images: 1,
  status: 1,
  createdAt: 1,
  isPremium: 1,
  "vendor._id": 1,
  "vendor.name": 1,
  "vendor.businessName": 1,
  "vendor.image": 1,
  "vendor.isBlocked": 1,
};

function toPublicDto(row: PublicRow) {
  return {
    id: row._id.toString(),
    itemName: row.itemName,
    category: row.category,
    description: row.description,
    price: row.price,
    location: row.location,
    images: row.images,
    status: row.status,
    createdAt: row.createdAt,
    vendor: {
      id: row.vendor._id.toString(),
      name: row.vendor.businessName?.trim() || row.vendor.name || "PizzaHub vendor",
      image: row.vendor.image ?? null,
      isPremium: row.isPremium === true,
    },
  };
}

async function menuItems() {
  return (await getDb()).collection("menuItems");
}

/** Public listing: approved items from non-blocked vendors, with search, filters, sorting and pagination. */
export async function listPublicItems(query: ListMenuQuery) {
  const filter: Document = { status: "approved" };
  if (query.category) filter.category = query.category;
  if (query.location) filter.location = { $regex: `^${escapeRegex(query.location)}$`, $options: "i" };
  if (query.q) {
    const pattern = escapeRegex(query.q);
    filter.$or = [
      { itemName: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ];
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const range: Document = {};
    if (query.minPrice !== undefined) range.$gte = query.minPrice;
    if (query.maxPrice !== undefined) range.$lte = query.maxPrice;
    filter.price = range;
  }

  const sort: Record<string, 1 | -1> =
    query.sort === "price_asc" ? { price: 1, _id: 1 } : query.sort === "price_desc" ? { price: -1, _id: 1 } : { createdAt: -1, _id: 1 };
  const skip = (query.page - 1) * query.limit;

  const [result] = await (await menuItems())
    .aggregate<{ items: PublicRow[]; total: { count: number }[] }>([
      { $match: filter },
      ...vendorJoin,
      hideBlockedVendors,
      {
        $facet: {
          items: [{ $sort: sort }, { $skip: skip }, { $limit: query.limit }, { $project: projection }],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  const total = result?.total[0]?.count ?? 0;
  return {
    items: (result?.items ?? []).map(toPublicDto),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

/** Homepage featured items: Premium vendors first, then newest. */
export async function listFeaturedItems(limit: number) {
  const rows = await (await menuItems())
    .aggregate<PublicRow>([
      { $match: { status: "approved" } },
      ...vendorJoin,
      hideBlockedVendors,
      { $sort: { isPremium: -1, createdAt: -1 } },
      { $limit: limit },
      { $project: projection },
    ])
    .toArray();
  return rows.map(toPublicDto);
}

export async function getMenuFilters() {
  const locations = (await (await menuItems()).distinct("location", { status: "approved" })) as string[];
  return { locations: locations.filter(Boolean).sort((a, b) => a.localeCompare(b)) };
}

/** Item details. Owners and admins can see any status; everyone else only approved items. */
export async function getItemDetails(user: AuthUser, id: ObjectId) {
  const [row] = await (await menuItems())
    .aggregate<PublicRow>([{ $match: { _id: id } }, ...vendorJoin, { $project: projection }])
    .toArray();
  if (!row) throw new ApiError(404, "Menu item not found", "ITEM_NOT_FOUND");

  const privileged = user.role === "admin" || row.vendor._id.equals(user.objectId);
  const visible = row.status === "approved" && row.vendor.isBlocked !== true;
  if (!privileged && !visible) throw new ApiError(404, "Menu item not found", "ITEM_NOT_FOUND");

  return toPublicDto(row);
}