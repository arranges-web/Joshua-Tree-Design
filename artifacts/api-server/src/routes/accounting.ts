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
    };

    const buckets = new Map<string, Bucket>();
    const keyForDept = (id: number | null) =>
      id == null ? UNATTRIBUTED_KEY : `dept-${id}`;

    function bucketFor(deptId: number | null): Bucket {
      const key = keyForDept(deptId);
      let bucket = buckets.get(key);
      if (!bucket) {
        const dept = deptId != null ? depts.find((d) => d.id === deptId) : null;
        bucket = {
          departmentId: deptId,
          departmentLabel: dept?.label ?? "Unattributed",
          openInvoiceCents: 0,
          collectedRevenueCents: 0,
          quotePipelineCents: 0,
          maintenanceSpendCents: 0,
          monthly: new Map(),
        };
        buckets.set(key, bucket);
      }
      return bucket;
    }

    // Pre-seed every department so even branches with no activity show up
    // as a row in the page (keeps the UI predictable).
    for (const d of depts) bucketFor(d.id);

    // Trailing 12 months — buckets get their month map seeded so the
    // chart never has gaps.
    const monthKeys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }
    for (const bucket of buckets.values()) {
      for (const m of monthKeys) {
        bucket.monthly.set(m, {
          collectedRevenueCents: 0,
          maintenanceSpendCents: 0,
        });
      }
    }

    // Invoices: split open vs paid, attribute to job's crew's department.
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
      }
    }

    // Quotes: pipeline = anything not yet decided (DRAFT, SENT). Owners
    // come from sales; departments come from the owner user.
    for (const q of quotes) {
      if (q.status !== "DRAFT" && q.status !== "SENT") continue;
      const owner = userById.get(q.ownerUserId);
      const bucket = bucketFor(owner?.departmentId ?? null);
      bucket.quotePipelineCents += q.totalCents;
    }

    // Maintenance: each log targets exactly one asset, and that asset
    // carries a required departmentId — so attribution is direct.
    for (const log of maintenanceLogs) {
      let deptId: number | null = null;
      if (log.truckId) deptId = truckDept.get(log.truckId) ?? null;
      else if (log.equipmentId) deptId = equipDept.get(log.equipmentId) ?? null;
      const bucket = bucketFor(deptId);
      bucket.maintenanceSpendCents += log.costCents ?? 0;
      const d = new Date(log.performedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = bucket.monthly.get(key);
      if (m) m.maintenanceSpendCents += log.costCents ?? 0;
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

    res.json({ totals, branches, orgMonthly });
  },
);

// Suppress unused-import warning when only one of the imports is used.
void eq;

export default router;
