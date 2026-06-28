import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const batteryEventsTable = pgTable("battery_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  level: integer("level").notNull(),
  isCharging: boolean("is_charging").notNull().default(false),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationName: text("location_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBatteryEventSchema = createInsertSchema(batteryEventsTable).omit(
  { id: true, userId: true, createdAt: true },
);
export type InsertBatteryEvent = z.infer<typeof insertBatteryEventSchema>;
export type BatteryEvent = typeof batteryEventsTable.$inferSelect;
