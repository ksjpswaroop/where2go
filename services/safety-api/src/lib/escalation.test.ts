import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  db,
  safetyTimersTable,
  emergencyContactsTable,
  checkInsTable,
  batteryEventsTable,
  tripsTable,
  usersTable,
} from "@where2go/safety-db";
import { eq } from "drizzle-orm";

import { runEscalationSweep } from "./escalation";

// Captured Twilio HTTP calls. We mock global fetch so no real SMS is ever sent;
// each entry records the recipient and message body Twilio would have received.
type SentMessage = { to: string; body: string };
let sentMessages: SentMessage[] = [];

// Track the user ids we seed so cleanup never touches unrelated data in the
// shared dev database.
const seededUserIds = new Set<string>();

function uniqueUserId(): string {
  const id = `test-escalation-${crypto.randomUUID()}`;
  seededUserIds.add(id);
  return id;
}

function uniquePhone(): string {
  // E.164-ish, unique per call so we can attribute sent messages to a contact.
  const digits = Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, "0");
  return `+1${digits}`;
}

async function cleanupSeededUsers(): Promise<void> {
  for (const userId of seededUserIds) {
    await Promise.all([
      db.delete(safetyTimersTable).where(eq(safetyTimersTable.userId, userId)),
      db
        .delete(emergencyContactsTable)
        .where(eq(emergencyContactsTable.userId, userId)),
      db.delete(checkInsTable).where(eq(checkInsTable.userId, userId)),
      db.delete(batteryEventsTable).where(eq(batteryEventsTable.userId, userId)),
      db.delete(tripsTable).where(eq(tripsTable.userId, userId)),
      db.delete(usersTable).where(eq(usersTable.id, userId)),
    ]);
  }
  seededUserIds.clear();
}

type SeedTimerOptions = {
  expiresAt: Date;
  status?: string;
  notifyContacts?: boolean;
  shareLocation?: boolean;
  escalatedAt?: Date | null;
  label?: string | null;
  withContact?: boolean;
};

async function seedTimer(userId: string, opts: SeedTimerOptions) {
  if (opts.withContact ?? true) {
    await db.insert(emergencyContactsTable).values({
      userId,
      name: "Test Contact",
      phone: uniquePhone(),
    });
  }
  const [timer] = await db
    .insert(safetyTimersTable)
    .values({
      userId,
      label: opts.label ?? "Test timer",
      expiresAt: opts.expiresAt,
      status: opts.status ?? "active",
      notifyContacts: opts.notifyContacts ?? true,
      shareLocation: opts.shareLocation ?? true,
      escalatedAt: opts.escalatedAt ?? null,
    })
    .returning();
  return timer;
}

async function getTimer(id: number) {
  const [row] = await db
    .select()
    .from(safetyTimersTable)
    .where(eq(safetyTimersTable.id, id))
    .limit(1);
  return row;
}

// Messages sent to a specific user's contacts (filtered by phone) so assertions
// are unaffected by any other rows that happen to live in the shared database.
async function messagesForUser(userId: string): Promise<SentMessage[]> {
  const contacts = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, userId));
  const phones = new Set(contacts.map((c) => c.phone));
  return sentMessages.filter((m) => phones.has(m.to));
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const minutesFromNow = (n: number) => new Date(Date.now() + n * 60_000);

beforeAll(() => {
  // resolveTwilioConfig() reads these at call time; set fake values so the
  // Twilio send path runs end-to-end (building the HTTP request) while the
  // actual network call is intercepted by the fetch mock below.
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest0000000000000000000000000000");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-auth-token");
  vi.stubEnv("TWILIO_PHONE_NUMBER", "+15005550006");

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      const body = init?.body;
      if (body instanceof URLSearchParams) {
        sentMessages.push({
          to: body.get("To") ?? "",
          body: body.get("Body") ?? "",
        });
      }
      return new Response("{}", { status: 201 });
    }),
  );
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  sentMessages = [];
});

afterEach(async () => {
  await cleanupSeededUsers();
});

describe("runEscalationSweep", () => {
  it("escalates an expired, active, notify-enabled timer exactly once (idempotent)", async () => {
    const userId = uniqueUserId();
    const timer = await seedTimer(userId, { expiresAt: minutesAgo(5) });

    await runEscalationSweep();

    const afterFirst = await getTimer(timer.id);
    expect(afterFirst.escalatedAt).not.toBeNull();
    // Escalation must NOT change the timer's status (the mobile reopen path and
    // the dashboard's active-timer query both depend on status staying "active").
    expect(afterFirst.status).toBe("active");

    const firstStamp = afterFirst.escalatedAt;
    expect(await messagesForUser(userId)).toHaveLength(1);

    // A second sweep must not re-claim or re-message the same timer.
    await runEscalationSweep();

    const afterSecond = await getTimer(timer.id);
    expect(afterSecond.escalatedAt?.getTime()).toBe(firstStamp?.getTime());
    expect(await messagesForUser(userId)).toHaveLength(1);
  });

  it("does not escalate when notifyContacts is false", async () => {
    const userId = uniqueUserId();
    const timer = await seedTimer(userId, {
      expiresAt: minutesAgo(5),
      notifyContacts: false,
    });

    await runEscalationSweep();

    const after = await getTimer(timer.id);
    expect(after.escalatedAt).toBeNull();
    expect(await messagesForUser(userId)).toHaveLength(0);
  });

  it("does not escalate a timer that has not yet expired", async () => {
    const userId = uniqueUserId();
    const timer = await seedTimer(userId, { expiresAt: minutesFromNow(10) });

    await runEscalationSweep();

    const after = await getTimer(timer.id);
    expect(after.escalatedAt).toBeNull();
    expect(await messagesForUser(userId)).toHaveLength(0);
  });

  it("does not escalate an already-completed timer", async () => {
    const userId = uniqueUserId();
    const timer = await seedTimer(userId, {
      expiresAt: minutesAgo(5),
      status: "completed",
    });

    await runEscalationSweep();

    const after = await getTimer(timer.id);
    expect(after.escalatedAt).toBeNull();
    expect(await messagesForUser(userId)).toHaveLength(0);
  });

  it("suppresses location when shareLocation is false", async () => {
    const userId = uniqueUserId();
    await db.insert(checkInsTable).values({
      userId,
      type: "custom",
      latitude: 48.8566,
      longitude: 2.3522,
      locationName: "Paris",
    });
    await seedTimer(userId, {
      expiresAt: minutesAgo(5),
      shareLocation: false,
    });

    await runEscalationSweep();

    const messages = await messagesForUser(userId);
    expect(messages).toHaveLength(1);
    const body = messages[0].body;
    expect(body).toContain("Location sharing is off for this alert.");
    expect(body).not.toContain("Paris");
    expect(body).not.toContain("maps.google.com");
  });

  it("includes last-known location when shareLocation is true", async () => {
    const userId = uniqueUserId();
    await db.insert(checkInsTable).values({
      userId,
      type: "custom",
      latitude: 48.8566,
      longitude: 2.3522,
      locationName: "Paris",
    });
    await seedTimer(userId, {
      expiresAt: minutesAgo(5),
      shareLocation: true,
    });

    await runEscalationSweep();

    const messages = await messagesForUser(userId);
    expect(messages).toHaveLength(1);
    const body = messages[0].body;
    expect(body).toContain("Last known location:");
    expect(body).toContain("Paris");
    expect(body).toContain("https://maps.google.com/?q=48.8566,2.3522");
    expect(body).not.toContain("Location sharing is off");
  });
});
