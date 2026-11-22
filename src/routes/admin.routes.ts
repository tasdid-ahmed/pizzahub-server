import { Router } from "express";
import * as users from "../controllers/adminUsers.controller.js";
import { requireRole } from "../middlewares/requireRole.js";
import { verifyToken } from "../middlewares/verifyToken.js";

export const adminRouter = Router();

adminRouter.use(verifyToken, requireRole("admin"));

adminRouter.get("/overview", users.overview);
adminRouter.get("/users", users.listUsers);
adminRouter.get("/users/:id", users.getUser);
adminRouter.patch("/users/:id/block", users.blockUser);