import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// status: "active" | "completed" | "stopped" | "expired"
export const safetyTimersTable = pgTable("safety_timers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"),
  shareLocation: boolean("share_location").notNull().default(true),
  notifyContacts: boolean("notify_contacts").notNull().default(true),
  // Set once the server has escalated this timer's expiry to emergency
  // contacts. Acts as an idempotency guard so a lapsed timer alerts contacts
  // exactly once. Null means it has not (yet) been escalated server-side.
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSafetyTimerSchema = createInsertSchema(safetyTimersTable).omit(
  { id: true, userId: true, status: true, createdAt: true },
);
export type InsertSafetyTimer = z.infer<typeof insertSafetyTimerSchema>;
export type SafetyTimer = typeof safetyTimersTable.$inferSelect;
