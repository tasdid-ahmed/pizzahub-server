import { z } from "zod";

export const chooseRoleSchema = z.object({
  role: z.enum(["customer", "vendor"]),
});