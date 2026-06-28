import {
  pgTable,
  text,
  serial,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationName: text("location_name"),
  photoUri: text("photo_uri"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

export const CreateJournalEntryBody = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().max(500).optional(),
  photoUri: z.string().max(2000).optional(),
});

export const UpdateJournalEntryBody = CreateJournalEntryBody.partial();
