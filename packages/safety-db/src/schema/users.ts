import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productModeEnum = z.enum(["family_day", "solo_travel"]);
export const subscriptionTierEnum = z.enum(["free", "plus", "pro"]);

// `id` is the Clerk user id. Local rows are JIT-provisioned on first request.
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  productMode: text("product_mode").notNull().default("solo_travel"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  batteryThreshold: integer("battery_threshold").notNull().default(5),
  lowBatterySos: boolean("low_battery_sos").notNull().default(true),
  shareLocationDefault: boolean("share_location_default").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
