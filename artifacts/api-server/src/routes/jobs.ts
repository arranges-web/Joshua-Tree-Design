import { Router, type IRouter } from "express";
import { db, jobsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import { scopeJobs } from "../lib/rbac/scope";
import { shapeJobForRole } from "../lib/rbac/shape";

const router: IRouter = Router();

router.get(
  "/jobs",
  requireAuth,
  requireSection("jobs", "view"),
  async (req, res) => {
    const user = req.user!;
    const where = scopeJobs(user);
    const query = db.select().from(jobsTable).limit(200);
    const rows = where ? await query.where(where) : await query;
    res.json({ jobs: rows.map((r) => shapeJobForRole(r, user.role)) });
  },
);

export default router;
