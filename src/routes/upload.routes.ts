import { Router } from "express";
import { uploadImageHandler } from "../controllers/upload.controller.js";
import { uploadImage } from "../middlewares/upload.js";
import { verifyToken } from "../middlewares/verifyToken.js";

export const uploadRouter = Router();

// Auth runs first, so anonymous requests never reach the file parser.
uploadRouter.post("/image", verifyToken, uploadImage, uploadImageHandler);