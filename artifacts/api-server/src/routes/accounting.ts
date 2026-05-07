import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  invoicesTable,
  quotesTable,
  jobsTable,
  crewsTable,
  usersTable,
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
  departmentsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";

const router: IRouter = Router();

// Sentinel id used when an invoice / maintenance log can't be attributed
// to any of the seeded departments. Surfaced in the UI as "Unattributed".
const UNATTRIBUTED_KEY = "__unattributed__";

// GET /accounting/summary
// Per-branch financial snapshot for the Accounting Manager view. All
// figures are computed in JS off small in-memory result sets — the seed
// data is tiny and recomputing on each request keeps the surface simple.
//
// Branch attribution rules:
//   invoices       → job.crew.leadUser.departmentId (fall back to
//                    "unattributed" when a job has no crew or no job).
//   quote pipeline → quote.ownerUser.departmentId.
//   maintenance    → asset.departmentId (already a direct FK).
router.get(
  "/accounting/summary",
  requireAuth,
  requireSection("accounting", "view"),
  async (_req, res) => {
    const [
      depts,
      invoices,
      quotes,
      jobs,
      crews,
      users,
      trucks,
      equipment,
      maintenanceLogs,
    ] = await Promise.all([
      db.select().from(departmentsTable),
      db.select().from(invoicesTable),
      db.select().from(quotesTable),
      db.select().from(jobsTable),
      db.select().from(crewsTable),
      db.select().from(usersTable),
      db.select({ id: trucksTable.id, departmentId: trucksTable.departmentId }).from(trucksTable),
      db.select({ id: equipmentTable.id, departmentId: equipmentTable.departmentId }).from(equipmentTable),
      db.select().from(maintenanceLogsTable),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const crewById = new Map(crews.map((c) => [c.id, c]));
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const truckDept = new Map(trucks.map((t) => [t.id, t.departmentId]));
    const equipDept = new Map(equipment.map((e) => [e.id, e.departmentId]));

    function deptForJob(jobId: number | null | undefined): number | null {
      if (jobId == null) return null;
      const job = jobById.get(jobId);
      if (!job?.crewId) return null;
      const crew = crewById.get(job.crewId);
      if (!crew) return null;
      const lead = userById.get(crew.leadUserId);
      return lead?.departmentId ?? null;
    }

    type AgingBucket = {
      currentCents: number; // not yet due (< 1d past issuedAt)
      d1to30Cents: number;
      d31to60Cents: number;
      d61to90Cents: number;
      d90plusCents: number;
    };

    type CategoryBuckets = {
      LABOR: { count: number; cents: number };
      PARTS: { count: number; cents: number };
      FUEL: { count: number; cents: number };
      OUTSOURCED: { count: number; cents: number };
      OTHER: { count: number; cents: number };
      UNCATEGORIZED: { count: number; cents: number };
    };
    function emptyCategoryBuckets(): CategoryBuckets {
      return {
        LABOR: { count: 0, cents: 0 },
        PARTS: { count: 0, cents: 0 },
        FUEL: { count: 0, cents: 0 },
        OUTSOURCED: { count: 0, cents: 0 },
        OTHER: { count: 0, cents: 0 },
        UNCATEGORIZED: { count: 0, cents: 0 },
      };
    }

    type QuoteStatusBuckets = {
      draft: { count: number; cents: number };
      sent: { count: number; cents: number };
      approved: { count: number; cents: number };
    };

    type Bucket = {
      departmentId: number | null;
      departmentLabel: string;
      openInvoiceCents: number;
      collectedRevenueCents: number;
      quotePipelineCents: number;
      maintenanceSpendCents: number;
      // Month rollups, keyed by `YYYY-MM`.
      monthly: Map<
        string,
        { collectedRevenueCents: number; maintenanceSpendCents: number }
      >;
      aging: AgingBucket;
      expensesByCategory: CategoryBuckets;
      quotesByStatus: QuoteStatusBuckets;
      maintenanceLogCount: number;
      maintenanceLogsWithReceipt: number;
    };

    const buckets = new Map<string, Bucket>();
    const keyForDept = (id: number | null) =>
      id == null ? UNATTRIBUTED_KEY : `dept-${id}`;

    // Build the trailing-12-month key list first so every bucket (including
    // dynamically-created ones for unattributed transactions) is immediately
    // seeded with zeroed monthly rows. This prevents `monthly.get(m)` from
    // returning undefined later in the reduce/map steps.
    const monthKeys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    function bucketFor(deptId: number | null): Bucket {
      const key = keyForDept(deptId);
      let bucket = buckets.get(key);
      if (!bucket) {
        const dept = deptId != null ? depts.find((d) => d.id === deptId) : null;
        const monthly = new Map<
          string,
          { collectedRevenueCents: number; maintenanceSpendCents: number }
        >();
        for (const m of monthKeys) {
          monthly.set(m, { collectedRevenueCents: 0, maintenanceSpendCents: 0 });
        }
        bucket = {
          departmentId: deptId,
          departmentLabel: dept?.label ?? "Unattributed",
          openInvoiceCents: 0,
          collectedRevenueCents: 0,
          quotePipelineCents: 0,
          maintenanceSpendCents: 0,
          monthly,
          aging: {
            currentCents: 0,
            d1to30Cents: 0,
            d31to60Cents: 0,
            d61to90Cents: 0,
            d90plusCents: 0,
          },
          expensesByCategory: emptyCategoryBuckets(),
          quotesByStatus: {
            draft: { count: 0, cents: 0 },
            sent: { count: 0, cents: 0 },
            approved: { count: 0, cents: 0 },
          },
          maintenanceLogCount: 0,
          maintenanceLogsWithReceipt: 0,
        };
        buckets.set(key, bucket);
      }
      return bucket;
    }

    // Pre-seed every department so even branches with no activity show up
    // as a row in the page (keeps the UI predictable).
    for (const d of depts) bucketFor(d.id);

    const NOW = Date.now();
    const DAY_MS = 86_400_000;

    // Invoices: split open vs paid, attribute to job's crew's department,
    // and bucket open invoices by days-past-issued for the receivables view.
    for (const inv of invoices) {
      const deptId = deptForJob(inv.jobId);
      const bucket = bucketFor(deptId);
      if (inv.status === "PAID") {
        bucket.collectedRevenueCents += inv.totalCents;
        const ts = inv.paidAt ?? inv.issuedAt;
        if (ts) {
          const d = new Date(ts);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const m = bucket.monthly.get(key);
          if (m) m.collectedRevenueCents += inv.totalCents;
        }
      } else {
        bucket.openInvoiceCents += inv.totalCents;
        // Aging is keyed off issuedAt → today. Falls into "current" when
        // there's no issued timestamp yet (DRAFT) or it's still in the
        // first day post-issue.
        let daysOpen = 0;
        if (inv.issuedAt) {
          daysOpen = Math.max(
            0,
            Math.floor((NOW - new Date(inv.issuedAt).getTime()) / DAY_MS),
          );
        }
        if (daysOpen < 1) bucket.aging.currentCents += inv.totalCents;
        else if (daysOpen <= 30) bucket.aging.d1to30Cents += inv.totalCents;
        else if (daysOpen <= 60) bucket.aging.d31to60Cents += inv.totalCents;
        else if (daysOpen <= 90) bucket.aging.d61to90Cents += inv.totalCents;
        else bucket.aging.d90plusCents += inv.totalCents;
      }
    }

    // Quotes: track every status (not just DRAFT/SENT) so the pipeline
    // page can show conversion. Pipeline cents stays as
    // DRAFT+SENT for backwards compat with the existing UI.
    for (const q of quotes) {
      const owner = userById.get(q.ownerUserId);
      const bucket = bucketFor(owner?.departmentId ?? null);
      const status = q.status;
      if (status === "DRAFT") {
        bucket.quotesByStatus.draft.count += 1;
        bucket.quotesByStatus.draft.cents += q.totalCents;
        bucket.quotePipelineCents += q.totalCents;
      } else if (status === "SENT") {
        bucket.quotesByStatus.sent.count += 1;
        bucket.quotesByStatus.sent.cents += q.totalCents;
        bucket.quotePipelineCents += q.totalCents;
      } else if (status === "APPROVED") {
        bucket.quotesByStatus.approved.count += 1;
        bucket.quotesByStatus.approved.cents += q.totalCents;
      }
    }

    // Maintenance: each log targets exactly one asset, and that asset
    // carries a required departmentId — so attribution is direct.
    // Tracks expenses by category + receipt coverage for the expenses tab.
    type MaintenanceLogRow = (typeof maintenanceLogs)[number] & {
      vendor?: string | null;
      category?: string | null;
      receiptDataUrl?: string | null;
    };
    const vendorTotals = new Map<string, { cents: number; count: number }>();
    for (const raw of maintenanceLogs as MaintenanceLogRow[]) {
      const log = raw;
      let deptId: number | null = null;
      if (log.truckId) deptId = truckDept.get(log.truckId) ?? null;
      else if (log.equipmentId) deptId = equipDept.get(log.equipmentId) ?? null;
      const bucket = bucketFor(deptId);
      const cents = log.costCents ?? 0;
      bucket.maintenanceSpendCents += cents;
      bucket.maintenanceLogCount += 1;
      if (log.receiptDataUrl != null && log.receiptDataUrl.length > 0) {
        bucket.maintenanceLogsWithReceipt += 1;
      }
      const d = new Date(log.performedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = bucket.monthly.get(key);
      if (m) m.maintenanceSpendCents += cents;
      const cat =
        log.category != null && log.category in bucket.expensesByCategory
          ? (log.category as keyof CategoryBuckets)
          : "UNCATEGORIZED";
      bucket.expensesByCategory[cat].count += 1;
      bucket.expensesByCategory[cat].cents += cents;
      if (log.vendor && log.vendor.trim().length > 0) {
        const k = log.vendor.trim();
        const v = vendorTotals.get(k) ?? { cents: 0, count: 0 };
        v.cents += cents;
        v.count += 1;
        vendorTotals.set(k, v);
      }
    }

    const branches = Array.from(buckets.values())
      .map((b) => ({
        departmentId: b.departmentId,
        departmentLabel: b.departmentLabel,
        openInvoiceCents: b.openInvoiceCents,
        collectedRevenueCents: b.collectedRevenueCents,
        quotePipelineCents: b.quotePipelineCents,
        maintenanceSpendCents: b.maintenanceSpendCents,
        monthly: monthKeys.map((m) => {
          const v = b.monthly.get(m)!;
          return {
            month: m,
            collectedRevenueCents: v.collectedRevenueCents,
            maintenanceSpendCents: v.maintenanceSpendCents,
          };
        }),
        aging: b.aging,
        expensesByCategory: b.expensesByCategory,
        quotesByStatus: b.quotesByStatus,
        maintenanceLogCount: b.maintenanceLogCount,
        maintenanceLogsWithReceipt: b.maintenanceLogsWithReceipt,
      }))
      .sort((a, b) => {
        // Real branches first, then "Unattributed" last.
        if (a.departmentId == null) return 1;
        if (b.departmentId == null) return -1;
        return a.departmentLabel.localeCompare(b.departmentLabel);
      });

    // Org-wide totals for the page header.
    const totals = branches.reduce(
      (acc, b) => ({
        openInvoiceCents: acc.openInvoiceCents + b.openInvoiceCents,
        collectedRevenueCents: acc.collectedRevenueCents + b.collectedRevenueCents,
        quotePipelineCents: acc.quotePipelineCents + b.quotePipelineCents,
        maintenanceSpendCents: acc.maintenanceSpendCents + b.maintenanceSpendCents,
      }),
      {
        openInvoiceCents: 0,
        collectedRevenueCents: 0,
        quotePipelineCents: 0,
        maintenanceSpendCents: 0,
      },
    );

    // Org-wide monthly aggregate so the top chart has its own series.
    const orgMonthly = monthKeys.map((m) => ({
      month: m,
      collectedRevenueCents: branches.reduce((s, b) => {
        const row = b.monthly.find((x) => x.month === m);
        return s + (row?.collectedRevenueCents ?? 0);
      }, 0),
      maintenanceSpendCents: branches.reduce((s, b) => {
        const row = b.monthly.find((x) => x.month === m);
        return s + (row?.maintenanceSpendCents ?? 0);
      }, 0),
    }));

    // Top vendors org-wide. Cap at 10 so the UI table stays readable.
    const topVendors = Array.from(vendorTotals.entries())
      .sort((a, b) => b[1].cents - a[1].cents)
      .slice(0, 10)
      .map(([vendor, v]) => ({
        vendor,
        cents: v.cents,
        logCount: v.count,
      }));

    res.json({ totals, branches, orgMonthly, topVendors });
  },
);

// Suppress unused-import warning when only one of the imports is used.
void eq;

export default router;
