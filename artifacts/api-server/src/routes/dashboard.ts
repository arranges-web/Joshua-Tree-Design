import { Router, type IRouter } from "express";
import { sql, eq, desc, isNull, and, gte } from "drizzle-orm";
import {
  db,
  jobsTable,
  quotesTable,
  invoicesTable,
  trucksTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";

const router: IRouter = Router();

router.get(
  "/admin/dashboard-summary",
  requireAuth,
  requireSection("dashboard.global", "view"),
  async (_req, res) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [jobsByStatus, quotePipelineByStage, recentJobs, fleetCounts, [{ employees }], pipelineRow, paidRow, outstandingRow] =
      await Promise.all([
        db
          .select({
            status: sql<string>`${jobsTable.status}`,
            count: sql<number>`count(*)::int`,
          })
          .from(jobsTable)
          .groupBy(jobsTable.status),
        db
          .select({
            status: sql<string>`${quotesTable.status}`,
            count: sql<number>`count(*)::int`,
          })
          .from(quotesTable)
          .groupBy(quotesTable.status),
        db
          .select({
            id: jobsTable.id,
            status: sql<string>`${jobsTable.status}`,
            totalCents: jobsTable.totalCents,
            scheduledFor: jobsTable.scheduledFor,
            notes: jobsTable.notes,
          })
          .from(jobsTable)
          .orderBy(desc(jobsTable.createdAt))
          .limit(8),
        db
          .select({
            status: sql<string>`${trucksTable.status}`,
            count: sql<number>`count(*)::int`,
          })
          .from(trucksTable)
          .groupBy(trucksTable.status),
        db
          .select({ employees: sql<number>`count(*)::int` })
          .from(usersTable)
          .where(eq(usersTable.isActive, true)),
        db
          .select({ total: sql<number>`coalesce(sum(${quotesTable.totalCents}), 0)::int` })
          .from(quotesTable)
          .where(sql`${quotesTable.status} IN ('DRAFT', 'SENT')`),
        db
          .select({ total: sql<number>`coalesce(sum(${invoicesTable.totalCents}), 0)::int` })
          .from(invoicesTable)
          .where(and(eq(invoicesTable.status, "PAID"), gte(invoicesTable.paidAt, monthStart))),
        db
          .select({ total: sql<number>`coalesce(sum(${invoicesTable.totalCents}), 0)::int` })
          .from(invoicesTable)
          .where(sql`${invoicesTable.status} IN ('SENT', 'OVERDUE')`),
      ]);

    const countOf = (rows: { status: string; count: number }[], key: string) =>
      rows.find((r) => r.status === key)?.count ?? 0;
    const completedThisMonthRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(and(eq(jobsTable.status, "COMPLETE"), gte(jobsTable.completedAt, monthStart)));

    res.json({
      kpi: {
        openJobs: countOf(jobsByStatus, "IN_PROGRESS"),
        scheduledJobs: countOf(jobsByStatus, "SCHEDULED"),
        completedThisMonth: completedThisMonthRows[0]?.count ?? 0,
        pipelineCents: pipelineRow[0]?.total ?? 0,
        paidThisMonthCents: paidRow[0]?.total ?? 0,
        outstandingInvoicesCents: outstandingRow[0]?.total ?? 0,
        fleetActive: countOf(fleetCounts, "ACTIVE"),
        fleetInShop: countOf(fleetCounts, "IN_SHOP"),
        employees,
      },
      jobsByStatus,
      quotePipelineByStage,
      recentJobs,
    });
  },
);

export default router;
