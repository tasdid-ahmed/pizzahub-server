import type { ObjectId } from "mongodb";
import type { Role } from "../utils/constants.js";

export interface AuthUser {
  id: string;
  objectId: ObjectId;
  name: string;
  email: string;
  role: Role;
  plan: "free" | "premium";
  subscriptionExpiresAt: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}