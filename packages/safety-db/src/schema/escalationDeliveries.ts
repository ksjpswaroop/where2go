import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Per-contact delivery record for a single safety-timer escalation. One row is
// created for each emergency contact when a lapsed timer is escalated, so the
// delivery outcome (sent / failed) is persisted rather than only logged, and a
// failed send can be retried a bounded number of times with backoff.
//
// status:
//   "pending" — awaiting an attempt now (nextAttemptAt <= now) or scheduled for
//               a later retry (nextAttemptAt in the future).
//   "sent"    — Twilio accepted the message; deliveredAt is set.
//   "failed"  — every attempt failed and maxAttempts was reached; terminal.
export const escalationDeliveriesTable = pgTable("escalation_deliveries", {
  id: serial("id").primaryKey(),
  timerId: integer("timer_id").notNull(),
  userId: text("user_id").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone").notNull(),
  // The exact alert body, captured once at escalation time so every retry sends
  // an identical message instead of rebuilding stale battery/location details.
  messageBody: text("message_body").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastError: text("last_error"),
  twilioMessageSid: text("twilio_message_sid"),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  // When the next attempt becomes due. Null once the row is terminal
  // (sent/failed). The retry sweep picks up pending rows whose time has come.
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertEscalationDeliverySchema = createInsertSchema(
  escalationDeliveriesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEscalationDelivery = z.infer<
  typeof insertEscalationDeliverySchema
>;
export type EscalationDelivery = typeof escalationDeliveriesTable.$inferSelect;
