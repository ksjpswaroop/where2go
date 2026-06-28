import { Router, type IRouter } from "express";
import {
  db,
  safetyTimersTable,
  batteryEventsTable,
  emergencyContactsTable,
  checkInsTable,
  tripsTable,
  escalationDeliveriesTable,
} from "@where2go/safety-db";
import { and, eq, desc, count } from "drizzle-orm";
import type { AuthedRequest } from "../middlewares/auth";

// Summarises the most recent escalation (all delivery rows sharing the newest
// timerId) so the traveler can see, on next app open, who was actually reached
// when a safety timer lapsed and contacts were alerted.
function summariseLatestEscalation(
  rows: (typeof escalationDeliveriesTable.$inferSelect)[],
) {
  if (rows.length === 0) return null;

  const latestTimerId = rows.reduce(
    (max, r) => (r.timerId > max ? r.timerId : max),
    rows[0]!.timerId,
  );
  const batch = rows.filter((r) => r.timerId === latestTimerId);

  const escalatedAt = batch.reduce<Date>(
    (min, r) => (r.createdAt < min ? r.createdAt : min),
    batch[0]!.createdAt,
  );

  const sent = batch.filter((r) => r.status === "sent").length;
  const failed = batch.filter((r) => r.status === "failed").length;
  const pending = batch.filter((r) => r.status === "pending").length;

  return {
    timerId: latestTimerId,
    escalatedAt: escalatedAt.toISOString(),
    total: batch.length,
    sent,
    failed,
    pending,
    contacts: batch
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((r) => ({
        name: r.contactName,
        status: r.status,
        attempts: r.attempts,
      })),
  };
}

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  const [activeTimerRows, latestBatteryRows, primaryContactRows, lastCheckInRows, activeTripRows, contactsCountRows, escalationRows] =
    await Promise.all([
      db
        .select()
        .from(safetyTimersTable)
        .where(
          and(
            eq(safetyTimersTable.userId, userId),
            eq(safetyTimersTable.status, "active"),
          ),
        )
        .orderBy(desc(safetyTimersTable.createdAt))
        .limit(1),
      db
        .select()
        .from(batteryEventsTable)
        .where(eq(batteryEventsTable.userId, userId))
        .orderBy(desc(batteryEventsTable.createdAt))
        .limit(1),
      db
        .select()
        .from(emergencyContactsTable)
        .where(
          and(
            eq(emergencyContactsTable.userId, userId),
            eq(emergencyContactsTable.isPrimary, true),
          ),
        )
        .limit(1),
      db
        .select()
        .from(checkInsTable)
        .where(eq(checkInsTable.userId, userId))
        .orderBy(desc(checkInsTable.createdAt))
        .limit(1),
      db
        .select()
        .from(tripsTable)
        .where(
          and(eq(tripsTable.userId, userId), eq(tripsTable.status, "active")),
        )
        .orderBy(desc(tripsTable.createdAt))
        .limit(1),
      db
        .select({ value: count() })
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.userId, userId)),
      db
        .select()
        .from(escalationDeliveriesTable)
        .where(eq(escalationDeliveriesTable.userId, userId))
        .orderBy(desc(escalationDeliveriesTable.createdAt))
        .limit(50),
    ]);

  res.json({
    activeTimer: activeTimerRows[0] ?? null,
    latestBattery: latestBatteryRows[0] ?? null,
    primaryContact: primaryContactRows[0] ?? null,
    lastCheckIn: lastCheckInRows[0] ?? null,
    activeTrip: activeTripRows[0] ?? null,
    contactsCount: contactsCountRows[0]?.value ?? 0,
    escalation: summariseLatestEscalation(escalationRows),
  });
});

export default router;
