import { Router } from "express";
import * as subscription from "../controllers/subscription.controller.js";
import { requireRole } from "../middlewares/requireRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

export const subscriptionRouter = Router();

subscriptionRouter.use(verifyToken, requireRole("vendor"));
subscriptionRouter.get("/", subscription.status);
subscriptionRouter.post("/checkout", subscription.checkout);
subscriptionRouter.post("/cancel", subscription.cancel);