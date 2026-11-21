import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // keeps us safely under Vercel's request body cap

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, "Only JPG, PNG or WebP images are allowed", "INVALID_FILE_TYPE"));
  },
}).single("image");