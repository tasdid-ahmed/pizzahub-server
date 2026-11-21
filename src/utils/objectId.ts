import { ObjectId } from "mongodb";
import { ApiError } from "./ApiError.js";

export function parseObjectId(value: unknown, label = "ID"): ObjectId {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new ApiError(400, `Invalid ${label}`, "INVALID_ID");
  }
  return new ObjectId(value);
}