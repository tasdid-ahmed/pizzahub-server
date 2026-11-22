export const ROLES = ["customer", "vendor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const MENU_CATEGORIES = [
  "classic",
  "vegetarian",
  "meat-lovers",
  "specialty",
  "sides",
  "beverages-desserts",
] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export const ITEM_STATUSES = ["pending", "approved", "rejected", "inactive"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Statuses that count toward the free-plan limit. */
export const LIVE_STATUSES: readonly ItemStatus[] = ["pending", "approved"];
export const FREE_PLAN_ITEM_LIMIT = 3;

export const PREMIUM_PRICE_CENTS = 999; // $9.99 per month
export const PREMIUM_CURRENCY = "usd";