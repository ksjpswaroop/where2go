import { Router, type IRouter } from "express";
import { db, emergencyContactsTable } from "@where2go/safety-db";
import { and, eq, desc, ne } from "drizzle-orm";
import { CreateContactBody, UpdateContactBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, userId))
    .orderBy(desc(emergencyContactsTable.isPrimary), desc(emergencyContactsTable.createdAt));
  res.json(rows);
});

router.post("/contacts", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const [contact] = await db.transaction(async (tx) => {
    if (data.isPrimary) {
      await tx
        .update(emergencyContactsTable)
        .set({ isPrimary: false })
        .where(eq(emergencyContactsTable.userId, userId));
    }
    return tx
      .insert(emergencyContactsTable)
      .values({
        userId,
        name: data.name,
        phone: data.phone,
        relation: data.relation ?? null,
        isPrimary: data.isPrimary ?? false,
      })
      .returning();
  });
  res.status(201).json(contact);
});

router.patch("/contacts/:id", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = parsed.data;
  const updated = await db.transaction(async (tx) => {
    if (data.isPrimary) {
      await tx
        .update(emergencyContactsTable)
        .set({ isPrimary: false })
        .where(
          and(
            eq(emergencyContactsTable.userId, userId),
            ne(emergencyContactsTable.id, id),
          ),
        );
    }
    const [row] = await tx
      .update(emergencyContactsTable)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.relation !== undefined ? { relation: data.relation } : {}),
        ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
      })
      .where(
        and(
          eq(emergencyContactsTable.id, id),
          eq(emergencyContactsTable.userId, userId),
        ),
      )
      .returning();
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(updated);
});

router.delete("/contacts/:id", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(emergencyContactsTable)
    .where(
      and(
        eq(emergencyContactsTable.id, id),
        eq(emergencyContactsTable.userId, userId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.status(204).send();
});

export default router;
