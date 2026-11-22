import type { RequestHandler } from "express";
import * as service from "../services/publicMenu.service.js";
import { parseObjectId } from "../utils/objectId.js";
import { featuredQuerySchema, listMenuQuerySchema } from "../validators/publicMenu.validators.js";

export const list: RequestHandler = async (req, res) => {
  const query = listMenuQuerySchema.parse(req.query);
  const { items, meta } = await service.listPublicItems(query);
  res.json({ success: true, data: items, meta });
};

export const featured: RequestHandler = async (req, res) => {
  const { limit } = featuredQuerySchema.parse(req.query);
  res.json({ success: true, data: await service.listFeaturedItems(limit) });
};

export const filters: RequestHandler = async (_req, res) => {
  res.json({ success: true, data: await service.getMenuFilters() });
};

export const details: RequestHandler = async (req, res) => {
  const data = await service.getItemDetails(req.user!, parseObjectId(req.params.id, "item ID"));
  res.json({ success: true, data });
};