import type { RequestHandler } from "express";
import * as service from "../services/menuItem.service.js";
import { parseObjectId } from "../utils/objectId.js";
import {
  availabilitySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from "../validators/menuItem.validators.js";

export const listMine: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await service.listVendorItems(req.user!) });
};

export const getOne: RequestHandler = async (req, res) => {
  const data = await service.getVendorItem(req.user!, parseObjectId(req.params.id, "item ID"));
  res.json({ success: true, data });
};

export const create: RequestHandler = async (req, res) => {
  const input = createMenuItemSchema.parse(req.body);
  const data = await service.createMenuItem(req.user!, input);
  res.status(201).json({ success: true, message: "Menu item submitted for admin review", data });
};

export const update: RequestHandler = async (req, res) => {
  const input = updateMenuItemSchema.parse(req.body);
  const data = await service.updateMenuItem(req.user!, parseObjectId(req.params.id, "item ID"), input);
  res.json({ success: true, message: "Menu item updated", data });
};

export const setAvailability: RequestHandler = async (req, res) => {
  const { available } = availabilitySchema.parse(req.body);
  const data = await service.setAvailability(req.user!, parseObjectId(req.params.id, "item ID"), available);
  res.json({ success: true, message: available ? "Item is available again" : "Item hidden from customers", data });
};

export const remove: RequestHandler = async (req, res) => {
  await service.deleteMenuItem(req.user!, parseObjectId(req.params.id, "item ID"));
  res.json({ success: true, message: "Menu item deleted" });
};