import { Router, type IRouter } from "express";
import healthRouter from "./health";
import webhooksRouter from "./webhooks";
import internalRouter from "./internal";
import { requireAuth } from "../middlewares/auth";
import meRouter from "./me";
import contactsRouter from "./contacts";
import tripsRouter from "./trips";
import safetyTimersRouter from "./safetyTimers";
import checkInsRouter from "./checkIns";
import batteryEventsRouter from "./batteryEvents";
import hotelScansRouter from "./hotelScans";
import dashboardRouter from "./dashboard";
import journalRouter from "./journal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(webhooksRouter);
router.use(internalRouter);

// All routes below require an authenticated Clerk session.
router.use(requireAuth);
router.use(meRouter);
router.use(contactsRouter);
router.use(tripsRouter);
router.use(safetyTimersRouter);
router.use(checkInsRouter);
router.use(batteryEventsRouter);
router.use(hotelScansRouter);
router.use(dashboardRouter);
router.use(journalRouter);

export default router;
