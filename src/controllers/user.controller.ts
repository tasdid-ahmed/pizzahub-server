import type { RequestHandler } from "express";
import type { Document } from "mongodb";
import { getDb } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { chooseRoleSchema, updateProfileSchema } from "../validators/user.validators.js";

export const getMe: RequestHandler = (req, res) => {
  const { objectId: _objectId, ...user } = req.user!;
  res.json({ success: true, data: user });
};

// One-time role choice for users who signed up with Google. The filter makes it atomic:
// it only matches while roleSelected is not true, so it can never change an existing role.
export const chooseRole: RequestHandler = async (req, res) => {
  const { role } = chooseRoleSchema.parse(req.body);
  const db = await getDb();
  const result = await db
    .collection("user")
    .updateOne(
      { _id: req.user!.objectId, roleSelected: { $ne: true } },
      { $set: { role, roleSelected: true, updatedAt: new Date() } },
    );
  if (result.matchedCount === 0) {
    throw new ApiError(409, "Your account role has already been set", "ROLE_ALREADY_SET");
  }
  res.json({ success: true, message: "Account role saved", data: { role } });
};

const toProfile = (doc: Document) => ({
  id: String(doc._id),
  name: doc.name ?? "",
  email: doc.email ?? "",
  image: doc.image ?? null,
  role: doc.role ?? "customer",
  businessName: doc.businessName ?? null,
});

export const getProfile: RequestHandler = async (req, res) => {
  const doc = await (await getDb()).collection("user").findOne({ _id: req.user!.objectId });
  if (!doc) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  res.json({ success: true, data: toProfile(doc) });
};

// Whitelisted fields only. Role, plan and block status can never change through this route.
export const updateProfile: RequestHandler = async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const user = req.user!;
  if (input.businessName !== undefined && user.role !== "vendor") {
    throw new ApiError(403, "Only vendors have a business name", "FORBIDDEN");
  }

  const changes: Document = { name: input.name, updatedAt: new Date() };
  if (input.image !== undefined) changes.image = input.image === "" ? null : input.image;
  if (input.businessName !== undefined) changes.businessName = input.businessName === "" ? null : input.businessName;

  const doc = await (await getDb())
    .collection("user")
    .findOneAndUpdate({ _id: user.objectId }, { $set: changes }, { returnDocument: "after" });
  if (!doc) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  res.json({ success: true, message: "Profile updated", data: toProfile(doc) });
};