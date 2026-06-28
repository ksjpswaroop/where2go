import { Router, type IRouter } from "express";
import { db, journalEntriesTable } from "@where2go/safety-db";
import { CreateJournalEntryBody, UpdateJournalEntryBody } from "@where2go/safety-db";
import { eq, desc, and } from "drizzle-orm";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/journal", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId))
    .orderBy(desc(journalEntriesTable.createdAt));
  res.json(rows);
});

router.post("/journal", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      userId,
      title: data.title ?? null,
      body: data.body,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationName: data.locationName ?? null,
      photoUri: data.photoUri ?? null,
      syncedAt: new Date(),
    })
    .returning();
  res.status(201).json(entry);
});

router.put("/journal/:id", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [entry] = await db
    .update(journalEntriesTable)
    .set({ ...parsed.data, updatedAt: new Date(), syncedAt: new Date() })
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId)))
    .returning();
  if (!entry) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(entry);
});

router.delete("/journal/:id", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [entry] = await db
    .delete(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId)))
    .returning();
  if (!entry) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

export default router;
