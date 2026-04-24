import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  customersTable,
  propertiesTable,
  jobsTable,
  quotesTable,
  invoicesTable,
  serviceRequestsTable,
} from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  DeleteCustomerParams,
  GetCustomerProfileParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import { scopeCustomers } from "../lib/rbac/scope";
import { shapeCustomerForRole } from "../lib/rbac/shape";

const router: IRouter = Router();

router.get(
  "/customers",
  requireAuth,
  requireSection("customers", "view"),
  async (req, res) => {
    const user = req.user!;
    const where = scopeCustomers(user);
    const query = db.select().from(customersTable).limit(500);
    const rows = where ? await query.where(where) : await query;
    res.json({ customers: rows.map((r) => shapeCustomerForRole(r, user.role)) });
  },
);

// Deep customer profile — properties, jobs (split upcoming / past), quotes,
// invoices, leads, plus rollup totals. Honors customer scope so SALES only
// see profiles for customers they own.
router.get(
  "/customers/:id",
  requireAuth,
  requireSection("customers", "view"),
  async (req, res) => {
    const user = req.user!;
    const params = GetCustomerProfileParams.safeParse({
      id: Number(req.params.id),
    });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeCustomers(user);
    const where = scope
      ? and(eq(customersTable.id, params.data.id), scope)
      : eq(customersTable.id, params.data.id);
    const customer = (
      await db.select().from(customersTable).where(where).limit(1)
    )[0];
    if (!customer) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const properties = await db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.customerId, customer.id))
      .orderBy(asc(propertiesTable.id));

    const propIds = properties.map((p) => p.id);

    const jobs = propIds.length
      ? await db
          .select()
          .from(jobsTable)
          .where(inArray(jobsTable.propertyId, propIds))
          .orderBy(desc(jobsTable.createdAt))
      : [];

    const upcoming = jobs.filter(
      (j) => j.status === "SCHEDULED" || j.status === "IN_PROGRESS",
    );
    const past = jobs.filter(
      (j) => j.status === "COMPLETE" || j.status === "CANCELLED",
    );

    const quotes = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.customerId, customer.id))
      .orderBy(desc(quotesTable.createdAt));

    const invoices = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.customerId, customer.id))
      .orderBy(desc(invoicesTable.id));

    const leads = await db
      .select()
      .from(serviceRequestsTable)
      .where(eq(serviceRequestsTable.customerId, customer.id))
      .orderBy(desc(serviceRequestsTable.createdAt));

    // Rollup totals (lifetime revenue from PAID invoices, open quote
    // exposure from DRAFT/SENT, outstanding from SENT/OVERDUE invoices).
    const lifetimeRevenueCents = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.totalCents, 0);
    const openQuoteCents = quotes
      .filter((q) => q.status === "DRAFT" || q.status === "SENT")
      .reduce((sum, q) => sum + q.totalCents, 0);
    const outstandingInvoiceCents = invoices
      .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
      .reduce((sum, i) => sum + i.totalCents, 0);
    const openLeadCount = leads.filter(
      (l) => l.status === "NEW" || l.status === "CONTACTED",
    ).length;

    res.json({
      customer: shapeCustomerForRole(customer, user.role),
      properties,
      jobs: { upcoming, past },
      quotes,
      invoices,
      leads,
      totals: {
        lifetimeRevenueCents,
        openQuoteCents,
        outstandingInvoiceCents,
        openLeadCount,
      },
    });
  },
);

router.post(
  "/customers",
  requireAuth,
  requireSection("customers", "edit"),
  async (req, res) => {
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const [row] = await db
      .insert(customersTable)
      .values(parsed.data)
      .returning();
    res.status(201).json({ customer: row });
  },
);

router.patch(
  "/customers/:id",
  requireAuth,
  requireSection("customers", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = UpdateCustomerParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateCustomerBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeCustomers(user);
    const where = scope
      ? and(eq(customersTable.id, params.data.id), scope)
      : eq(customersTable.id, params.data.id);
    const [row] = await db
      .update(customersTable)
      .set(body.data)
      .where(where)
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ customer: row });
  },
);

router.delete(
  "/customers/:id",
  requireAuth,
  requireSection("customers", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = DeleteCustomerParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeCustomers(user);
    const where = scope
      ? and(eq(customersTable.id, params.data.id), scope)
      : eq(customersTable.id, params.data.id);
    const deleted = await db
      .delete(customersTable)
      .where(where)
      .returning({ id: customersTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
