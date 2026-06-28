import { Router, type IRouter } from "express";
import { db, usersTable } from "@where2go/safety-db";
import { eq } from "drizzle-orm";
import { normalizeTier } from "../lib/subscription";

const router: IRouter = Router();

router.post("/internal/subscription", async (req, res) => {
  const secret = process.env.SAFETY_API_INTERNAL_SECRET?.trim();
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!secret || auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = String(req.body?.userId ?? "");
  const tier = normalizeTier(String(req.body?.subscriptionTier ?? "free"));
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }

  await db
    .update(usersTable)
    .set({ subscriptionTier: tier, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true, userId, subscriptionTier: tier });
});

export default router;
