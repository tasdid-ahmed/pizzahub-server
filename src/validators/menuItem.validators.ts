import { z } from "zod";
import { MENU_CATEGORIES } from "../utils/constants.js";

// Only images uploaded through our ImgBB endpoint are accepted.
const imageUrl = z.url().refine((value) => {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && (hostname === "ibb.co" || hostname.endsWith(".ibb.co"));
  } catch {
    return false;
  }
}, "Images must be uploaded through PizzaHub");

export const createMenuItemSchema = z.object({
  itemName: z.string().trim().min(3, "Name must be at least 3 characters").max(80),
  category: z.enum(MENU_CATEGORIES),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000),
  price: z
    .number()
    .positive("Price must be greater than 0")
    .max(100000)
    .transform((value) => Math.round(value * 100) / 100),
  location: z.string().trim().min(2, "Location is required").max(80),
  images: z.array(imageUrl).min(1, "Upload at least one image").max(4, "You can upload up to 4 images"),
});

export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const availabilitySchema = z.object({ available: z.boolean() });

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;