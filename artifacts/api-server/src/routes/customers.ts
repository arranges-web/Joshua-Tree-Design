import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  customersTable,
  propertiesTable,
  jobsTable,
  crewsTable,
  quotesTable,
  invoicesTable,
  serviceRequestsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  DeleteCustomerParams,
  GetCustomerProfileParams,
  CreateCustomerPropertyBody,
  CreateCustomerPropertyParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import {
  scopeCustomers,
  scopeJobs,
  scopeQuotes,
  scopeServiceRequests,
} from "../lib/rbac/scope";
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

    // Owner rep — sales rep this customer is assigned to.
    const owner = customer.ownerUserId
      ? (
          await db
            .select({
              id: usersTable.id,
              fullName: usersTable.fullName,
              email: usersTable.email,
            })
            .from(usersTable)
            .where(eq(usersTable.id, customer.ownerUserId))
            .limit(1)
        )[0] ?? null
      : null;

    const properties = await db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.customerId, customer.id))
      .orderBy(asc(propertiesTable.id));

    const propIds = properties.map((p) => p.id);

    // Pull jobs for any of this customer's properties. Re-uses the shared
    // scopeJobs helper so SALES / CREW_LEAD only see jobs they're entitled
    // to — we never want a customer profile leaking jobs that the role
    // wouldn't see on the main /jobs page.
    const jobsScope = scopeJobs(user);
    const jobsWhere = propIds.length
      ? jobsScope
        ? and(inArray(jobsTable.propertyId, propIds), jobsScope)
        : inArray(jobsTable.propertyId, propIds)
      : null;
    const jobs = jobsWhere
      ? await db.select().from(jobsTable).where(jobsWhere)
      : [];

    const upcoming = jobs
      .filter((j) => j.status === "SCHEDULED" || j.status === "IN_PROGRESS")
      .sort((a, b) => {
        const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Infinity;
        const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Infinity;
        return ta - tb;
      });
    const past = jobs
      .filter((j) => j.status === "COMPLETE" || j.status === "CANCELLED")
      .sort((a, b) => {
        const ta = a.completedAt
          ? new Date(a.completedAt).getTime()
          : new Date(a.createdAt).getTime();
        const tb = b.completedAt
          ? new Date(b.completedAt).getTime()
          : new Date(b.createdAt).getTime();
        return tb - ta;
      });

    // Crew lookup so the UI can render crew names alongside each job
    // without making a second list-crews call.
    const crewIds = Array.from(
      new Set(jobs.map((j) => j.crewId).filter((c): c is number => c != null)),
    );
    const crews = crewIds.length
      ? await db
          .select({ id: crewsTable.id, name: crewsTable.name })
          .from(crewsTable)
          .where(inArray(crewsTable.id, crewIds))
      : [];

    // Quotes — use scopeQuotes so a SALES rep only ever sees their own
    // quotes for this customer, even if some other rep also has quotes
    // attached to them. ADMIN sees all.
    const quotesScope = scopeQuotes(user);
    const quotesWhere = quotesScope
      ? and(eq(quotesTable.customerId, customer.id), quotesScope)
      : eq(quotesTable.customerId, customer.id);
    const quotes = await db
      .select()
      .from(quotesTable)
      .where(quotesWhere)
      .orderBy(desc(quotesTable.createdAt));

    // Invoices — there's no scopeInvoices helper yet, but visibility is
    // already gated by `customers/view` + customer-level scope above, and
    // invoices belong 1:1 to a customer the caller is entitled to see.
    const invoices = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.customerId, customer.id))
      .orderBy(desc(invoicesTable.id));

    // Leads — scopeServiceRequests already filters by customer ownership
    // for SALES, which is redundant here (we've already gated by customer)
    // but applying it keeps the auth path consistent with /api/leads.
    // Join properties so each lead row carries propertyAddress, matching
    // the /api/leads response shape so the UI can render service +
    // property + when-submitted without an extra round trip.
    const leadsScope = scopeServiceRequests(user);
    const leadsWhere = leadsScope
      ? and(eq(serviceRequestsTable.customerId, customer.id), leadsScope)
      : eq(serviceRequestsTable.customerId, customer.id);
    const leadRows = await db
      .select({
        lead: serviceRequestsTable,
        propertyAddress: propertiesTable.address,
      })
      .from(serviceRequestsTable)
      .leftJoin(
        propertiesTable,
        eq(serviceRequestsTable.propertyId, propertiesTable.id),
      )
      .where(leadsWhere)
      .orderBy(desc(serviceRequestsTable.createdAt));
    const leads = leadRows.map((r) => ({
      ...r.lead,
      customerName: customer.fullName,
      propertyAddress: r.propertyAddress,
    }));

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
      owner,
      properties,
      jobs: { upcoming, past },
      quotes,
      invoices,
      leads,
      crews,
      totals: {
        lifetimeRevenueCents,
        openQuoteCents,
        outstandingInvoiceCents,
        openLeadCount,
      },
    });
  },
);

// Create a property for a specific customer — used by the customer profile
// "Add property" action so the new property is auto-associated. Honors the
// same customer scope as the profile read so SALES can only add properties
// to customers they own.
router.post(
  "/customers/:id/properties",
  requireAuth,
  requireSection("customers", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = CreateCustomerPropertyParams.safeParse({
      id: Number(req.params.id),
    });
    const body = CreateCustomerPropertyBody.safeParse(req.body);
    if (!params.success || !body.success) {
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
    const [row] = await db
      .insert(propertiesTable)
      .values({ ...body.data, customerId: customer.id })
      .returning();
    res.status(201).json({ property: row });
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
