import { z } from "zod";
import { parseDateOnly, todayInDhaka } from "../utils/dates.js";

export const createOrderSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  deliveryDate: z
    .string()
    .refine((value) => parseDateOnly(value) !== null, "Enter a valid delivery date")
    .refine((value) => value >= todayInDhaka(), "Delivery date can't be in the past"),
  deliveryAddress: z.string().trim().min(10, "Please enter a full delivery address").max(200, "Address is too long"),
  message: z.string().trim().max(300, "Message is too long").optional(),
});

export const decideOrderSchema = z.object({ status: z.enum(["accepted", "rejected"]) });

export const ordersQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "rejected", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;