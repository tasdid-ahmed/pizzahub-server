import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { chooseRole, getMe, getProfile, updateProfile } from "../controllers/user.controller.js";

export const userRouter = Router();

userRouter.use(verifyToken);
userRouter.get("/", getMe);
userRouter.post("/role", chooseRole);
userRouter.get("/profile", getProfile);
userRouter.patch("/", updateProfile);