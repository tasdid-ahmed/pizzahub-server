import { z } from "zod";
import { MENU_CATEGORIES } from "../utils/constants.js";

export const listMenuQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.enum(MENU_CATEGORIES).optional(),
  location: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(9),
});

export const featuredQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

export type ListMenuQuery = z.infer<typeof listMenuQuerySchema>;