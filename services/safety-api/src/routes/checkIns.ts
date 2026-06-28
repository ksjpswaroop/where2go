import { Router, type IRouter } from "express";
import { db, checkInsTable } from "@where2go/safety-db";
import { eq, desc } from "drizzle-orm";
import { CreateCheckInBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/check-ins", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(checkInsTable)
    .where(eq(checkInsTable.userId, userId))
    .orderBy(desc(checkInsTable.createdAt));
  res.json(rows);
});

router.post("/check-ins", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateCheckInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [checkIn] = await db
    .insert(checkInsTable)
    .values({
      userId,
      type: data.type,
      label: data.label ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationName: data.locationName ?? null,
    })
    .returning();
  res.status(201).json(checkIn);
});

export default router;
