import { z } from "zod";
import { ITEM_STATUSES, MENU_CATEGORIES, ROLES } from "../utils/constants.js";

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(ROLES).optional(),
  ...pagination,
});

export const adminItemsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  category: z.enum(MENU_CATEGORIES).optional(),
  ...pagination,
});

export const adminTransactionsQuerySchema = z.object({
  status: z.enum(["pending", "paid", "failed"]).optional(),
  ...pagination,
});

export const blockUserSchema = z.object({ blocked: z.boolean() });
export const itemStatusSchema = z.object({ status: z.enum(["approved", "rejected", "inactive"]) });

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminItemsQuery = z.infer<typeof adminItemsQuerySchema>;
export type AdminTransactionsQuery = z.infer<typeof adminTransactionsQuerySchema>;