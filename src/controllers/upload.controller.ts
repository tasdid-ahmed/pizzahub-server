import type { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError.js";
import { uploadToImgBB } from "../services/upload.service.js";

export const uploadImageHandler: RequestHandler = async (req, res) => {
  if (!req.file) throw new ApiError(400, "Please choose an image to upload", "NO_FILE");
  const url = await uploadToImgBB(req.file.buffer);
  res.status(201).json({ success: true, data: { url } });
};