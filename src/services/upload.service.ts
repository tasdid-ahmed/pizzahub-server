import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export async function uploadToImgBB(file: Buffer): Promise<string> {
  if (!env.IMGBB_API_KEY) {
    throw new ApiError(503, "Image uploads are not configured on the server", "UPLOAD_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({ image: file.toString("base64") });
  let response: Response;
  try {
    response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    throw new ApiError(502, "Image upload timed out. Please try again.", "UPLOAD_FAILED");
  }

  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: { url?: string } } | null;
  if (!response.ok || !json?.success || !json.data?.url) {
    throw new ApiError(502, "Image upload failed. Please try again.", "UPLOAD_FAILED");
  }
  return json.data.url;
}