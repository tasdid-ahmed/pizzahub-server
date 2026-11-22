import type { RequestHandler } from "express";
import * as service from "../services/adminUsers.service.js";
import { parseObjectId } from "../utils/objectId.js";
import { adminUsersQuerySchema, blockUserSchema } from "../validators/admin.validators.js";

export const overview: RequestHandler = async (_req, res) => {
  res.json({ success: true, data: await service.getOverview() });
};

export const listUsers: RequestHandler = async (req, res) => {
  const { items, meta } = await service.listUsers(adminUsersQuerySchema.parse(req.query));
  res.json({ success: true, data: items, meta });
};

export const getUser: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await service.getUserDetails(parseObjectId(req.params.id, "user ID")) });
};

export const blockUser: RequestHandler = async (req, res) => {
  const { blocked } = blockUserSchema.parse(req.body);
  const data = await service.setUserBlocked(req.user!, parseObjectId(req.params.id, "user ID"), blocked);
  res.json({ success: true, message: blocked ? "User blocked" : "User unblocked", data });
};