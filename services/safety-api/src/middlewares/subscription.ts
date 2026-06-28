import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@where2go/safety-db";
import { eq } from "drizzle-orm";
import type { AuthedRequest } from "./auth";
import { tierAllowsFeature, type PaidFeature } from "../lib/subscription";

export function requireFeature(feature: PaidFeature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const [user] = await db
      .select({ subscriptionTier: usersTable.subscriptionTier })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const tier = user?.subscriptionTier ?? "free";
    if (!tierAllowsFeature(tier, feature)) {
      res.status(402).json({
        error: "Subscription required",
        feature,
        requiredTier: "plus",
      });
      return;
    }
    next();
  };
}

export async function attachSubscriptionTier(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  if (auth?.userId) {
    const [user] = await db
      .select({ subscriptionTier: usersTable.subscriptionTier })
      .from(usersTable)
      .where(eq(usersTable.id, auth.userId))
      .limit(1);
    (req as AuthedRequest & { subscriptionTier?: string }).subscriptionTier =
      user?.subscriptionTier ?? "free";
  }
  next();
}
