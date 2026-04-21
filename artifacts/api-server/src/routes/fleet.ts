import { Router, type IRouter } from "express";
import { db, trucksTable, maintenanceLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";

const router: IRouter = Router();

router.get(
  "/trucks",
  requireAuth,
  requireSection("fleet.trucks", "view"),
  async (_req, res) => {
    const rows = await db.select().from(trucksTable).limit(200);
    res.json({ trucks: rows });
  },
);

router.get(
  "/maintenance-logs",
  requireAuth,
  requireSection("fleet.maintenance", "view"),
  async (_req, res) => {
    const rows = await db.select().from(maintenanceLogsTable).limit(200);
    res.json({ logs: rows });
  },
);

export default router;
