import { z } from "zod";

export const chooseRoleSchema = z.object({
  role: z.enum(["customer", "vendor"]),
});

const httpsUrl = z.url().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Image must be an https URL");

export const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  image: z.union([z.literal(""), httpsUrl]).optional(),
  businessName: z
    .string()
    .trim()
    .max(80, "Business name is too long")
    .refine((value) => value === "" || value.length >= 2, "Business name must be at least 2 characters")
    .optional(),
});