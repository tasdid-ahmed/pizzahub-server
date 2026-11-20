import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";
import { ApiError } from "../utils/ApiError.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, "NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ success: false, message: err.message, code: err.code, details: err.details });
  } else if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details: z.flattenError(err).fieldErrors,
    });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Invalid JSON body", code: "INVALID_JSON" });
  } else {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong on our side", code: "INTERNAL_ERROR" });
  }
};