import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import {
  CreateJobBody,
  UpdateJobBody,
  UpdateJobParams,
  DeleteJobParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import { scopeJobs } from "../lib/rbac/scope";
import { shapeJobForRole } from "../lib/rbac/shape";

const router: IRouter = Router();

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETE" | "CANCELLED";

function coerceJobInput<
  T extends {
    status?: string;
    scheduledFor?: string | Date | null;
    completedAt?: string | Date | null;
  },
>(input: T) {
  return {
    ...input,
    status: input.status as JobStatus | undefined,
    scheduledFor:
      typeof input.scheduledFor === "string"
        ? new Date(input.scheduledFor)
        : (input.scheduledFor ?? null),
    completedAt:
      typeof input.completedAt === "string"
        ? new Date(input.completedAt)
        : (input.completedAt ?? null),
  };
}

router.get(
  "/jobs",
  requireAuth,
  requireSection("jobs", "view"),
  async (req, res) => {
    const user = req.user!;
    const where = scopeJobs(user);
    const query = db.select().from(jobsTable).limit(500);
    const rows = where ? await query.where(where) : await query;
    res.json({ jobs: rows.map((r) => shapeJobForRole(r, user.role)) });
  },
);

router.post(
  "/jobs",
  requireAuth,
  requireSection("jobs", "edit"),
  async (req, res) => {
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const [row] = await db
      .insert(jobsTable)
      .values(coerceJobInput(parsed.data))
      .returning();
    res.status(201).json({ job: row });
  },
);

router.patch(
  "/jobs/:id",
  requireAuth,
  requireSection("jobs", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = UpdateJobParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateJobBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeJobs(user);
    const where = scope
      ? and(eq(jobsTable.id, params.data.id), scope)
      : eq(jobsTable.id, params.data.id);
    const [row] = await db
      .update(jobsTable)
      .set(coerceJobInput(body.data))
      .where(where)
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ job: row });
  },
);

router.delete(
  "/jobs/:id",
  requireAuth,
  requireSection("jobs", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = DeleteJobParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeJobs(user);
    const where = scope
      ? and(eq(jobsTable.id, params.data.id), scope)
      : eq(jobsTable.id, params.data.id);
    const deleted = await db
      .delete(jobsTable)
      .where(where)
      .returning({ id: jobsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
