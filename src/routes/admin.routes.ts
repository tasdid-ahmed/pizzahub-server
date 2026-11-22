import { Router } from "express";
import * as users from "../controllers/adminUsers.controller.js";
import { requireRole } from "../middlewares/requireRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import * as menu from "../controllers/adminMenu.controller.js";

export const adminRouter = Router();

adminRouter.use(verifyToken, requireRole("admin"));

adminRouter.get("/overview", users.overview);
adminRouter.get("/users", users.listUsers);
adminRouter.get("/users/:id", users.getUser);
adminRouter.patch("/users/:id/block", users.blockUser);

adminRouter.get("/menu-items", menu.listItems);
adminRouter.patch("/menu-items/:id/status", menu.setItemStatus);
adminRouter.delete("/menu-items/:id", menu.deleteItem);

// Transactions are read-only for admins: there is deliberately no write route.
adminRouter.get("/transactions", menu.listTransactions);