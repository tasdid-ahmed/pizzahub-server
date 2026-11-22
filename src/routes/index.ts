import { Router } from "express";
import { getDb } from "../config/db.js";
import { userRouter } from "./user.routes.js";
import { uploadRouter } from "./upload.routes.js";
import { vendorRouter } from "./vendor.routes.js";
import { menuRouter } from "./menu.routes.js";
import { adminRouter } from "./admin.routes.js";

export const router = Router();

router.get("/health", async (_req, res) => {
  let database = "connected";
  try {
    await (await getDb()).command({ ping: 1 });
  } catch {
    database = "unreachable";
  }
  res.json({ success: true, message: "PizzaHub API is running", database, time: new Date().toISOString() });
});

router.use("/me", userRouter);
router.use("/uploads", uploadRouter);
router.use("/vendor", vendorRouter);
router.use("/menu-items", menuRouter);
router.use("/admin", adminRouter);