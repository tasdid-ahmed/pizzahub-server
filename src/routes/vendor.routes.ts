import { Router } from "express";
import * as menuItems from "../controllers/vendorMenuItem.controller.js";
import { requireRole } from "../middlewares/requireRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import * as orders from "../controllers/order.controller.js";

export const vendorRouter = Router();

vendorRouter.use(verifyToken, requireRole("vendor"));

vendorRouter.get("/menu-items", menuItems.listMine);
vendorRouter.post("/menu-items", menuItems.create);
vendorRouter.get("/menu-items/:id", menuItems.getOne);
vendorRouter.patch("/menu-items/:id", menuItems.update);
vendorRouter.patch("/menu-items/:id/availability", menuItems.setAvailability);
vendorRouter.delete("/menu-items/:id", menuItems.remove);

vendorRouter.get("/orders", orders.vendorList);
vendorRouter.patch("/orders/:id", orders.decide);
vendorRouter.get("/overview", orders.vendorOverview);