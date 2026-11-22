import type { RequestHandler } from "express";
import * as service from "../services/order.service.js";
import { parseObjectId } from "../utils/objectId.js";
import { createOrderSchema, decideOrderSchema, ordersQuerySchema } from "../validators/order.validators.js";

export const create: RequestHandler = async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const data = await service.createOrder(req.user!, input, parseObjectId(input.itemId, "item ID"));
  res.status(201).json({ success: true, message: "Order placed successfully", data });
};

export const customerList: RequestHandler = async (req, res) => {
  const { items, meta } = await service.listCustomerOrders(req.user!, ordersQuerySchema.parse(req.query));
  res.json({ success: true, data: items, meta });
};

export const cancel: RequestHandler = async (req, res) => {
  const data = await service.cancelOrder(req.user!, parseObjectId(req.params.id, "order ID"));
  res.json({ success: true, message: "Order cancelled", data });
};

export const customerOverview: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await service.getCustomerOverview(req.user!) });
};

export const vendorList: RequestHandler = async (req, res) => {
  const { items, meta } = await service.listVendorOrders(req.user!, ordersQuerySchema.parse(req.query));
  res.json({ success: true, data: items, meta });
};

export const decide: RequestHandler = async (req, res) => {
  const { status } = decideOrderSchema.parse(req.body);
  const data = await service.decideOrder(req.user!, parseObjectId(req.params.id, "order ID"), status);
  res.json({ success: true, message: `Order ${status}`, data });
};

export const vendorOverview: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await service.getVendorOverview(req.user!) });
};