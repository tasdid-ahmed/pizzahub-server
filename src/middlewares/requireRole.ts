import type { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError.js";
import type { Role } from "../utils/constants.js";

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new ApiError(401, "Authentication required", "UNAUTHENTICATED");
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "You do not have permission to perform this action", "FORBIDDEN");
    }
    next();
  };