import { Router, type IRouter } from "express";
import { db, escalationDeliveriesTable } from "@where2go/safety-db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** Twilio delivery status callback — must be mounted before requireAuth. */
router.post("/webhooks/twilio/sms-status", async (req, res) => {
  const messageSid = String(req.body?.MessageSid ?? "");
  const messageStatus = String(req.body?.MessageStatus ?? "");
  const to = String(req.body?.To ?? "");

  if (!messageSid) {
    res.status(400).send("Missing MessageSid");
    return;
  }

  logger.info({ messageSid, messageStatus, to }, "Twilio SMS status webhook");

  if (messageStatus === "delivered" || messageStatus === "failed" || messageStatus === "undelivered") {
    const status = messageStatus === "delivered" ? "sent" : "failed";
    await db
      .update(escalationDeliveriesTable)
      .set({
        status,
        lastError: messageStatus === "delivered" ? null : messageStatus,
        updatedAt: new Date(),
      })
      .where(eq(escalationDeliveriesTable.twilioMessageSid, messageSid));
  }

  res.status(200).send("ok");
});

export default router;
