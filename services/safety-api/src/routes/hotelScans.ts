import { Router, type IRouter } from "express";
import { db, hotelScansTable } from "@where2go/safety-db";
import { eq, desc } from "drizzle-orm";
import { CreateHotelScanBody } from "@where2go/safety-api-zod";
import type { AuthedRequest } from "../middlewares/auth";
import { requireFeature } from "../middlewares/subscription";
import { scanHotel } from "../lib/hotelScanner";

const router: IRouter = Router();

router.get("/hotel-scans", async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(hotelScansTable)
    .where(eq(hotelScansTable.userId, userId))
    .orderBy(desc(hotelScansTable.createdAt));
  res.json(rows);
});

router.post("/hotel-scans", requireFeature("hotel_scanner"), async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateHotelScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const query = parsed.data.query.trim();

  let result;
  try {
    result = await scanHotel(query);
  } catch (err) {
    req.log?.error({ err }, "Hotel scan failed");
    res.status(502).json({ error: "The safety scanner is unavailable right now. Please try again." });
    return;
  }

  const [scan] = await db
    .insert(hotelScansTable)
    .values({
      userId,
      query,
      hotelName: result.hotelName,
      overallScore: result.overallScore,
      neighborhoodScore: result.neighborhoodScore,
      soloFemaleScore: result.soloFemaleScore,
      deadboltMentioned: result.deadboltMentioned,
      summary: result.summary,
      tips: result.tips,
    })
    .returning();
  res.status(201).json(scan);
});

export default router;
