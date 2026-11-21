import { Router } from "express";
import { chooseRole, getMe } from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

export const userRouter = Router();

userRouter.use(verifyToken);
userRouter.get("/", getMe);
userRouter.post("/role", chooseRole);