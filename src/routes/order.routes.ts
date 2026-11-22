import { Router } from "express";
import * as orders from "../controllers/order.controller.js";
import { requireRole } from "../middlewares/requireRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

// Only customers can place orders. Vendors and admins get a 403.
export const orderRouter = Router();
orderRouter.post("/", verifyToken, requireRole("customer"), orders.create);

export const customerRouter = Router();
customerRouter.use(verifyToken, requireRole("customer"));
customerRouter.get("/orders", orders.customerList);
customerRouter.patch("/orders/:id/cancel", orders.cancel);
customerRouter.get("/overview", orders.customerOverview);