import { Router, type IRouter } from "express";
import { db, safetyTimersTable } from "@where2go/safety-db";
import { and, eq, desc } from "drizzle-orm";
import { CreateSafetyTimerBody, UpdateSafetyTimerBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/safety-timers", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(safetyTimersTable)
    .where(eq(safetyTimersTable.userId, userId))
    .orderBy(desc(safetyTimersTable.createdAt));
  res.json(rows);
});

router.post("/safety-timers", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateSafetyTimerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [timer] = await db
    .insert(safetyTimersTable)
    .values({
      userId,
      label: data.label ?? null,
      expiresAt: new Date(data.expiresAt),
      shareLocation: data.shareLocation ?? true,
      notifyContacts: data.notifyContacts ?? true,
      status: "active",
    })
    .returning();
  res.status(201).json(timer);
});

router.patch("/safety-timers/:id", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateSafetyTimerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [timer] = await db
    .update(safetyTimersTable)
    .set({
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.expiresAt !== undefined
        ? { expiresAt: new Date(data.expiresAt) }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.shareLocation !== undefined
        ? { shareLocation: data.shareLocation }
        : {}),
      ...(data.notifyContacts !== undefined
        ? { notifyContacts: data.notifyContacts }
        : {}),
    })
    .where(
      and(eq(safetyTimersTable.id, id), eq(safetyTimersTable.userId, userId)),
    )
    .returning();
  if (!timer) {
    res.status(404).json({ error: "Safety timer not found" });
    return;
  }
  res.json(timer);
});

export default router;
