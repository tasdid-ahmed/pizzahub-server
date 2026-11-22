import type { RequestHandler } from "express";
import * as service from "../services/adminMenu.service.js";
import { parseObjectId } from "../utils/objectId.js";
import {
  adminItemsQuerySchema,
  adminTransactionsQuerySchema,
  itemStatusSchema,
} from "../validators/admin.validators.js";

export const listItems: RequestHandler = async (req, res) => {
  const { items, meta } = await service.listItems(adminItemsQuerySchema.parse(req.query));
  res.json({ success: true, data: items, meta });
};

export const setItemStatus: RequestHandler = async (req, res) => {
  const { status } = itemStatusSchema.parse(req.body);
  const data = await service.setItemStatus(parseObjectId(req.params.id, "item ID"), status);
  res.json({ success: true, message: `Item marked as ${status}`, data });
};

export const deleteItem: RequestHandler = async (req, res) => {
  await service.deleteItem(parseObjectId(req.params.id, "item ID"));
  res.json({ success: true, message: "Menu item deleted" });
};

export const listTransactions: RequestHandler = async (req, res) => {
  const { items, meta } = await service.listTransactions(adminTransactionsQuerySchema.parse(req.query));
  res.json({ success: true, data: items, meta });
};