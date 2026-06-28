import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@where2go/safety-db";
import { eq } from "drizzle-orm";

export interface AuthedRequest extends Request {
  userId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const provisioned = new Set<string>();

async function ensureUser(userId: string): Promise<void> {
  if (provisioned.has(userId)) return;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing.length > 0) {
    provisioned.add(userId);
    return;
  }

  let email: string | null = null;
  let displayName: string | null = null;
  try {
    const u = await clerkClient.users.getUser(userId);
    email =
      u.primaryEmailAddress?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      null;
    displayName =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || null;
  } catch {
    // Profile lookup is best-effort; still create the local row.
  }

  await db
    .insert(usersTable)
    .values({ id: userId, email, displayName })
    .onConflictDoNothing();
  provisioned.add(userId);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await ensureUser(userId);
  } catch (err) {
    req.log?.error({ err }, "Failed to provision user");
    res.status(500).json({ error: "Failed to provision user" });
    return;
  }

  (req as AuthedRequest).userId = userId;
  next();
}
