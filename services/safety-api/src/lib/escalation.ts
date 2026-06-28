// Server-side escalation for lapsed safety timers.
//
// Task #3 added an on-device local notification when a safety timer expires,
// but that still requires the traveler's phone to be on and for them to tap
// "send". If the phone is dead, lost, or offline, contacts are never reached.
// This sweep runs on the server: when an active timer passes its expiry without
// being completed/extended, it messages the traveler's emergency contacts
// directly via SMS (Twilio), including last known location when permitted.
//
// Idempotency: a timer is "claimed" by atomically stamping `escalatedAt` before
// any SMS is sent, so a given timer escalates at most once. Completing,
// stopping, or extending the timer before expiry takes it out of the sweep's
// query, cancelling the escalation.
//
// Note: this deliberately does NOT change the timer's `status`. The dashboard's
// activeTimer query only returns status="active" rows, and the mobile app
// relies on an expired-but-active timer to re-surface its in-app prompt when
// reopened. Flipping status here would silently kill that reopen path.
import {
  db,
  safetyTimersTable,
  emergencyContactsTable,
  batteryEventsTable,
  checkInsTable,
  tripsTable,
  usersTable,
  escalationDeliveriesTable,
} from "@where2go/safety-db";
import { and, eq, lt, lte, isNull, desc, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { sendSms } from "./twilio";
import { tierAllowsFeature } from "./subscription";

// A failed send is retried up to this many total attempts (initial + retries)
// before the delivery is marked permanently failed.
const MAX_DELIVERY_ATTEMPTS = 5;

// Backoff between retries, indexed by the number of attempts already made.
// After attempt N fails, we wait BACKOFF_MS[N-1] (clamped to the last entry)
// before the next attempt becomes due.
const BACKOFF_MS = [30_000, 120_000, 300_000, 900_000];

function backoffMs(attemptsMade: number): number {
  const idx = Math.min(Math.max(attemptsMade - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 30_000;
}

type KnownLocation = {
  latitude: number;
  longitude: number;
  locationName: string | null;
  at: Date;
};

function mapsUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * Best available location the server can attach to an alert. The traveler's
 * phone may be dead/offline, so we use the most recent coordinates recorded by
 * either a check-in or a battery event, whichever is newer.
 */
async function getLastKnownLocation(
  userId: string,
): Promise<KnownLocation | null> {
  const [checkInRows, batteryRows] = await Promise.all([
    db
      .select()
      .from(checkInsTable)
      .where(
        and(
          eq(checkInsTable.userId, userId),
          isNotNull(checkInsTable.latitude),
          isNotNull(checkInsTable.longitude),
        ),
      )
      .orderBy(desc(checkInsTable.createdAt))
      .limit(1),
    db
      .select()
      .from(batteryEventsTable)
      .where(
        and(
          eq(batteryEventsTable.userId, userId),
          isNotNull(batteryEventsTable.latitude),
          isNotNull(batteryEventsTable.longitude),
        ),
      )
      .orderBy(desc(batteryEventsTable.createdAt))
      .limit(1),
  ]);

  const candidates: KnownLocation[] = [];
  const checkIn = checkInRows[0];
  if (checkIn?.latitude != null && checkIn.longitude != null) {
    candidates.push({
      latitude: checkIn.latitude,
      longitude: checkIn.longitude,
      locationName: checkIn.locationName ?? null,
      at: checkIn.createdAt,
    });
  }
  const battery = batteryRows[0];
  if (battery?.latitude != null && battery.longitude != null) {
    candidates.push({
      latitude: battery.latitude,
      longitude: battery.longitude,
      locationName: battery.locationName ?? null,
      at: battery.createdAt,
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  return candidates[0] ?? null;
}

type TimerRow = typeof safetyTimersTable.$inferSelect;

async function buildEscalationMessage(timer: TimerRow): Promise<string> {
  const [userRows, latestBatteryRows, activeTripRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, timer.userId)).limit(1),
    db
      .select()
      .from(batteryEventsTable)
      .where(eq(batteryEventsTable.userId, timer.userId))
      .orderBy(desc(batteryEventsTable.createdAt))
      .limit(1),
    db
      .select()
      .from(tripsTable)
      .where(
        and(eq(tripsTable.userId, timer.userId), eq(tripsTable.status, "active")),
      )
      .orderBy(desc(tripsTable.createdAt))
      .limit(1),
  ]);

  const name = userRows[0]?.displayName?.trim();
  const battery = latestBatteryRows[0] ?? null;
  const destination = activeTripRows[0]?.destination?.trim();

  const label = timer.label?.trim();
  const lines: string[] = [
    `🆘 SafeTrip alert${name ? ` for ${name}` : ""}. A safety timer${
      label ? ` ("${label}")` : ""
    } expired without a check-in, so they may need help.`,
    "",
  ];

  if (battery && typeof battery.level === "number") {
    lines.push(
      `Battery: ${battery.level}%${battery.isCharging ? " (charging)" : ""}`,
    );
  }

  if (!timer.shareLocation) {
    lines.push("Location sharing is off for this alert.");
  } else {
    const loc = await getLastKnownLocation(timer.userId);
    if (loc) {
      lines.push(
        `Last known location: ${
          loc.locationName ? loc.locationName + " — " : ""
        }${mapsUrl(loc.latitude, loc.longitude)}`,
      );
    } else {
      lines.push("Last known location: currently unavailable");
    }
  }

  if (destination) {
    lines.push(`Destination: ${destination}`);
  }

  lines.push("");
  lines.push("Sent automatically by Where2Go because a safety timer expired.");

  return lines.join("\n");
}

async function userHasServerEscalation(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ subscriptionTier: usersTable.subscriptionTier })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return tierAllowsFeature(user?.subscriptionTier, "server_escalation");
}

type DeliveryRow = typeof escalationDeliveriesTable.$inferSelect;

/**
 * Escalates a single timer: records a delivery row for each emergency contact.
 * The actual sending (and any retries) is handled uniformly by
 * `processDueDeliveries`, which runs immediately after in the same sweep, so a
 * just-created delivery gets its first attempt right away. Assumes the caller
 * has already claimed the timer (stamped `escalatedAt`).
 */
async function escalateTimer(timer: TimerRow): Promise<void> {
  const allowed = await userHasServerEscalation(timer.userId);
  if (!allowed) {
    logger.info(
      { timerId: timer.id, userId: timer.userId },
      "Skipping server escalation — subscription tier does not include server SMS",
    );
    return;
  }

  const contacts = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, timer.userId));

  const recipients = contacts
    .map((c) => ({ name: c.name?.trim() || null, phone: c.phone?.trim() }))
    .filter((c): c is { name: string | null; phone: string } =>
      Boolean(c.phone),
    );

  if (recipients.length === 0) {
    logger.warn(
      { timerId: timer.id, userId: timer.userId },
      "Safety timer expired but the traveler has no emergency contacts to alert",
    );
    return;
  }

  const message = await buildEscalationMessage(timer);
  const now = new Date();

  await db.insert(escalationDeliveriesTable).values(
    recipients.map((r) => ({
      timerId: timer.id,
      userId: timer.userId,
      contactName: r.name,
      contactPhone: r.phone,
      messageBody: message,
      status: "pending" as const,
      attempts: 0,
      maxAttempts: MAX_DELIVERY_ATTEMPTS,
      // Due immediately so the first attempt happens in this same sweep run.
      nextAttemptAt: now,
    })),
  );

  logger.info(
    { timerId: timer.id, userId: timer.userId, contacts: recipients.length },
    "Queued safety escalation deliveries for emergency contacts",
  );
}

/**
 * Attempts a single delivery once and persists the outcome. On success the row
 * becomes terminal ("sent"); on failure it is either rescheduled for a later
 * retry (status stays "pending", nextAttemptAt bumped by backoff) or marked
 * permanently "failed" once maxAttempts is reached.
 */
async function attemptDelivery(delivery: DeliveryRow): Promise<void> {
  const [result] = await sendSms([delivery.contactPhone], delivery.messageBody);
  const attempts = delivery.attempts + 1;
  const now = new Date();

  if (result?.ok) {
    await db
      .update(escalationDeliveriesTable)
      .set({
        status: "sent",
        attempts,
        lastError: null,
        twilioMessageSid: result.messageSid ?? null,
        lastAttemptAt: now,
        nextAttemptAt: null,
        deliveredAt: now,
        updatedAt: now,
      })
      .where(eq(escalationDeliveriesTable.id, delivery.id));
    logger.info(
      { deliveryId: delivery.id, timerId: delivery.timerId, attempts },
      "Delivered safety escalation SMS",
    );
    return;
  }

  const error = result?.error ?? "unknown send error";

  if (attempts >= delivery.maxAttempts) {
    await db
      .update(escalationDeliveriesTable)
      .set({
        status: "failed",
        attempts,
        lastError: error,
        lastAttemptAt: now,
        nextAttemptAt: null,
        updatedAt: now,
      })
      .where(eq(escalationDeliveriesTable.id, delivery.id));
    logger.error(
      {
        deliveryId: delivery.id,
        timerId: delivery.timerId,
        attempts,
        err: error,
      },
      "Safety escalation SMS permanently failed after exhausting retries",
    );
    return;
  }

  const nextAttemptAt = new Date(now.getTime() + backoffMs(attempts));
  await db
    .update(escalationDeliveriesTable)
    .set({
      status: "pending",
      attempts,
      lastError: error,
      lastAttemptAt: now,
      nextAttemptAt,
      updatedAt: now,
    })
    .where(eq(escalationDeliveriesTable.id, delivery.id));
  logger.warn(
    {
      deliveryId: delivery.id,
      timerId: delivery.timerId,
      attempts,
      nextAttemptAt,
      err: error,
    },
    "Safety escalation SMS failed; scheduled retry",
  );
}

/**
 * Sends every pending delivery whose retry time has come (including ones just
 * queued by `escalateTimer`). Runs within the sweep guard so it never overlaps
 * with itself or with timer claiming.
 */
async function processDueDeliveries(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(escalationDeliveriesTable)
    .where(
      and(
        eq(escalationDeliveriesTable.status, "pending"),
        lte(escalationDeliveriesTable.nextAttemptAt, now),
      ),
    )
    .orderBy(escalationDeliveriesTable.nextAttemptAt);

  for (const delivery of due) {
    try {
      await attemptDelivery(delivery);
    } catch (err) {
      logger.error(
        { err, deliveryId: delivery.id },
        "Error while attempting safety escalation delivery",
      );
    }
  }
}

let sweepRunning = false;

/**
 * Finds every active safety timer that has passed its expiry without being
 * completed/extended and whose owner wants contacts notified, queues a delivery
 * for each emergency contact, then sends every due delivery (first attempts plus
 * any retries whose backoff has elapsed). Guards against overlapping runs.
 */
export async function runEscalationSweep(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const now = new Date();

    // Atomically claim due timers by stamping `escalatedAt`. The WHERE clause
    // guarantees a timer is claimed at most once even if a sweep overlaps, and
    // RETURNING gives us exactly the rows this run owns.
    const claimed = await db
      .update(safetyTimersTable)
      .set({ escalatedAt: now })
      .where(
        and(
          eq(safetyTimersTable.status, "active"),
          eq(safetyTimersTable.notifyContacts, true),
          lt(safetyTimersTable.expiresAt, now),
          isNull(safetyTimersTable.escalatedAt),
        ),
      )
      .returning();

    for (const timer of claimed) {
      try {
        await escalateTimer(timer);
      } catch (err) {
        logger.error(
          { err, timerId: timer.id },
          "Error while escalating safety timer",
        );
      }
    }

    // Always run: this sends the first attempt for any timer just escalated and
    // retries earlier deliveries whose backoff window has now elapsed, even on
    // sweeps where no new timer was claimed.
    await processDueDeliveries();
  } catch (err) {
    logger.error({ err }, "Safety timer escalation sweep failed");
  } finally {
    sweepRunning = false;
  }
}

const SWEEP_INTERVAL_MS = 30_000;

/**
 * Starts the recurring escalation sweep. Returns a stop function. The interval
 * is unref'd so it never keeps the process alive on its own.
 */
export function startEscalationScheduler(): () => void {
  void runEscalationSweep();
  const handle = setInterval(() => {
    void runEscalationSweep();
  }, SWEEP_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();
  return () => clearInterval(handle);
}
