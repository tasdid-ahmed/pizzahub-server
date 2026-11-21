import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { getDb } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ROLES, type Role } from "../utils/constants.js";
import type { AuthUser } from "../types/auth.js";

const jwks = createRemoteJWKSet(new URL(`${env.CLIENT_URL}/api/auth/jwks`));

export const verifyToken: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required", "UNAUTHENTICATED");
  }

  let subject: string | undefined;
  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), jwks, {
      issuer: env.CLIENT_URL,
      audience: env.CLIENT_URL,
    });
    subject = payload.sub;
  } catch {
    throw new ApiError(401, "Invalid or expired token", "INVALID_TOKEN");
  }

  if (!subject || !ObjectId.isValid(subject)) {
    throw new ApiError(401, "Invalid token subject", "INVALID_TOKEN");
  }

  // The token only identifies the user. Role, block status and plan always come from the database.
  const db = await getDb();
  const doc = await db.collection("user").findOne({ _id: new ObjectId(subject) });
  if (!doc) throw new ApiError(401, "User no longer exists", "UNAUTHENTICATED");
  if (doc.isBlocked === true) {
    throw new ApiError(403, "Your account has been blocked", "USER_BLOCKED");
  }

  const expiresAt = doc.subscriptionExpiresAt ? new Date(doc.subscriptionExpiresAt) : null;
  const isPremium = doc.subscriptionPlan === "premium" && expiresAt !== null && expiresAt > new Date();

  const user: AuthUser = {
    id: doc._id.toString(),
    objectId: doc._id,
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    role: ROLES.includes(doc.role) ? (doc.role as Role) : "customer",
    plan: isPremium ? "premium" : "free",
    subscriptionExpiresAt: expiresAt,
  };
  req.user = user;
  next();
};