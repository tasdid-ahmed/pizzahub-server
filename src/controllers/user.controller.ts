import type { RequestHandler } from "express";
import { getDb } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { chooseRoleSchema } from "../validators/user.validators.js";

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