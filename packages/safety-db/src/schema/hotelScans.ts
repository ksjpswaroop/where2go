import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hotelScansTable = pgTable("hotel_scans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  query: text("query").notNull(),
  hotelName: text("hotel_name"),
  overallScore: integer("overall_score").notNull(),
  neighborhoodScore: integer("neighborhood_score").notNull(),
  soloFemaleScore: integer("solo_female_score").notNull(),
  deadboltMentioned: boolean("deadbolt_mentioned").notNull().default(false),
  summary: text("summary").notNull(),
  tips: jsonb("tips").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHotelScanSchema = createInsertSchema(hotelScansTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type InsertHotelScan = z.infer<typeof insertHotelScanSchema>;
export type HotelScan = typeof hotelScansTable.$inferSelect;
