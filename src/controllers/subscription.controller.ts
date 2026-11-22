import type { RequestHandler } from "express";
import * as service from "../services/subscription.service.js";

export const status: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await service.getSubscriptionStatus(req.user!) });
};

export const checkout: RequestHandler = async (req, res) => {
  res.status(201).json({ success: true, data: await service.createCheckoutSession(req.user!) });
};

export const cancel: RequestHandler = async (req, res) => {
  const data = await service.cancelSubscription(req.user!);
  res.json({ success: true, message: "Your subscription will end at the close of the current billing period", data });
};