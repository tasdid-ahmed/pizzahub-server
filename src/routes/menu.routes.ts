import { Router } from "express";
import * as menu from "../controllers/publicMenu.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

export const menuRouter = Router();

menuRouter.get("/", menu.list);
menuRouter.get("/featured", menu.featured);
menuRouter.get("/filters", menu.filters);
menuRouter.get("/:id", verifyToken, menu.details); // details are a private page