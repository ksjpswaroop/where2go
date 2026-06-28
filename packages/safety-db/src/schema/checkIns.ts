import {
  pgTable,
  text,
  serial,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// type: "landed" | "reached_hotel" | "leaving_hotel" | "custom"
export const checkInsTable = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  label: text("label"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationName: text("location_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckInSchema = createInsertSchema(checkInsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkInsTable.$inferSelect;
