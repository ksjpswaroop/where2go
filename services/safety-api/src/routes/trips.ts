import { Router, type IRouter } from "express";
import { db, tripsTable } from "@where2go/safety-db";
import { and, eq, desc } from "drizzle-orm";
import { CreateTripBody, UpdateTripBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/trips", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.userId, userId))
    .orderBy(desc(tripsTable.createdAt));
  res.json(rows);
});

router.post("/trips", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [trip] = await db
    .insert(tripsTable)
    .values({
      userId,
      title: data.title,
      destination: data.destination ?? null,
      status: data.status ?? "active",
    })
    .returning();
  res.status(201).json(trip);
});

router.patch("/trips/:id", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [trip] = await db
    .update(tripsTable)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.destination !== undefined ? { destination: data.destination } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(and(eq(tripsTable.id, id), eq(tripsTable.userId, userId)))
    .returning();
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  res.json(trip);
});

export default router;
