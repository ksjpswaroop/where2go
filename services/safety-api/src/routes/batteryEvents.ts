import { Router, type IRouter } from "express";
import { db, batteryEventsTable } from "@where2go/safety-db";
import { eq, desc } from "drizzle-orm";
import { CreateBatteryEventBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/battery-events/latest", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const [row] = await db
    .select()
    .from(batteryEventsTable)
    .where(eq(batteryEventsTable.userId, userId))
    .orderBy(desc(batteryEventsTable.createdAt))
    .limit(1);
  res.json(row ?? null);
});

router.post("/battery-events", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateBatteryEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [event] = await db
    .insert(batteryEventsTable)
    .values({
      userId,
      level: data.level,
      isCharging: data.isCharging ?? false,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationName: data.locationName ?? null,
    })
    .returning();
  res.status(201).json(event);
});

export default router;
