import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { db, usersTable, emergencyContactsTable, tripsTable, safetyTimersTable, checkInsTable, batteryEventsTable, hotelScansTable, escalationDeliveriesTable } from "@where2go/safety-db";
import { eq } from "drizzle-orm";
import { UpdateMeBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/me", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  res.json(user);
});

router.delete("/me", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(escalationDeliveriesTable).where(eq(escalationDeliveriesTable.userId, userId));
      await tx.delete(hotelScansTable).where(eq(hotelScansTable.userId, userId));
      await tx.delete(batteryEventsTable).where(eq(batteryEventsTable.userId, userId));
      await tx.delete(checkInsTable).where(eq(checkInsTable.userId, userId));
      await tx.delete(safetyTimersTable).where(eq(safetyTimersTable.userId, userId));
      await tx.delete(tripsTable).where(eq(tripsTable.userId, userId));
      await tx.delete(emergencyContactsTable).where(eq(emergencyContactsTable.userId, userId));
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });
    await clerkClient.users.deleteUser(userId);
    res.status(204).send();
  } catch (err) {
    req.log?.error({ err, userId }, "Account deletion failed");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
