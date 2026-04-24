import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  serviceRequestsTable,
  customersTable,
  propertiesTable,
  quotesTable,
  type ServiceRequest,
} from "@workspace/db";
import {
  CreateLeadBody,
  UpdateLeadBody,
  UpdateLeadParams,
  ListLeadsQueryParams,
  ConvertLeadToQuoteParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import {
  scopeServiceRequests,
  scopeCustomers,
} from "../lib/rbac/scope";

const router: IRouter = Router();

type LeadRow = ServiceRequest & {
  customerName: string | null;
  propertyAddress: string | null;
};

async function loadLeadById(
  id: number,
  scope: ReturnType<typeof scopeServiceRequests>,
): Promise<LeadRow | null> {
  const where = scope
    ? and(eq(serviceRequestsTable.id, id), scope)
    : eq(serviceRequestsTable.id, id);
  const rows = await db
    .select({
      lead: serviceRequestsTable,
      customerName: customersTable.fullName,
      propertyAddress: propertiesTable.address,
    })
    .from(serviceRequestsTable)
    .innerJoin(
      customersTable,
      eq(serviceRequestsTable.customerId, customersTable.id),
    )
    .leftJoin(
      propertiesTable,
      eq(serviceRequestsTable.propertyId, propertiesTable.id),
    )
    .where(where)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row.lead,
    customerName: row.customerName,
    propertyAddress: row.propertyAddress,
  };
}

router.get(
  "/leads",
  requireAuth,
  requireSection("leads", "view"),
  async (req, res) => {
    const user = req.user!;
    const parsedQuery = ListLeadsQueryParams.safeParse(req.query);
    const statusFilter = parsedQuery.success
      ? parsedQuery.data.status
      : undefined;

    const scope = scopeServiceRequests(user);
    const conditions = [scope, statusFilter ? eq(serviceRequestsTable.status, statusFilter as ServiceRequest["status"]) : undefined].filter(
      Boolean,
    ) as NonNullable<ReturnType<typeof scopeServiceRequests>>[];
    const where = conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

    const baseQuery = db
      .select({
        lead: serviceRequestsTable,
        customerName: customersTable.fullName,
        propertyAddress: propertiesTable.address,
      })
      .from(serviceRequestsTable)
      .innerJoin(
        customersTable,
        eq(serviceRequestsTable.customerId, customersTable.id),
      )
      .leftJoin(
        propertiesTable,
        eq(serviceRequestsTable.propertyId, propertiesTable.id),
      )
      .orderBy(desc(serviceRequestsTable.createdAt))
      .limit(500);

    const rows = where ? await baseQuery.where(where) : await baseQuery;
    const leads: LeadRow[] = rows.map((r) => ({
      ...r.lead,
      customerName: r.customerName,
      propertyAddress: r.propertyAddress,
    }));
    res.json({ leads });
  },
);

router.post(
  "/leads",
  requireAuth,
  requireSection("leads", "edit"),
  async (req, res) => {
    const user = req.user!;
    const parsed = CreateLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    // Make sure SALES can only create leads for customers they own.
    const custScope = scopeCustomers(user);
    const custWhere = custScope
      ? and(eq(customersTable.id, parsed.data.customerId), custScope)
      : eq(customersTable.id, parsed.data.customerId);
    const ownsCustomer = (
      await db.select({ id: customersTable.id }).from(customersTable).where(custWhere).limit(1)
    )[0];
    if (!ownsCustomer) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    // Cross-customer IDOR guard: if a property was supplied, it must
    // belong to the same customer the lead is being created for.
    if (parsed.data.propertyId != null) {
      const prop = (
        await db
          .select({ id: propertiesTable.id })
          .from(propertiesTable)
          .where(
            and(
              eq(propertiesTable.id, parsed.data.propertyId),
              eq(propertiesTable.customerId, parsed.data.customerId),
            ),
          )
          .limit(1)
      )[0];
      if (!prop) {
        res.status(400).json({ error: "property_not_owned_by_customer" });
        return;
      }
    }
    const [row] = await db
      .insert(serviceRequestsTable)
      .values({
        customerId: parsed.data.customerId,
        propertyId: parsed.data.propertyId ?? null,
        service: parsed.data.service as ServiceRequest["service"],
        notes: parsed.data.notes ?? null,
        preferredWindowStart: parsed.data.preferredWindowStart ?? null,
        preferredWindowEnd: parsed.data.preferredWindowEnd ?? null,
        ...(parsed.data.status
          ? { status: parsed.data.status as ServiceRequest["status"] }
          : {}),
        ...(parsed.data.source
          ? { source: parsed.data.source as ServiceRequest["source"] }
          : {}),
      })
      .returning();
    const lead = await loadLeadById(row!.id, scopeServiceRequests(user));
    res.status(201).json({ lead });
  },
);

router.patch(
  "/leads/:id",
  requireAuth,
  requireSection("leads", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = UpdateLeadParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateLeadBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeServiceRequests(user);
    const where = scope
      ? and(eq(serviceRequestsTable.id, params.data.id), scope)
      : eq(serviceRequestsTable.id, params.data.id);

    // If propertyId is being changed, validate it belongs to this lead's
    // customer so a SALES user can't reassign to another customer's property.
    if (body.data.propertyId !== undefined && body.data.propertyId !== null) {
      const existing = (
        await db
          .select({ customerId: serviceRequestsTable.customerId })
          .from(serviceRequestsTable)
          .where(where)
          .limit(1)
      )[0];
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const prop = (
        await db
          .select({ id: propertiesTable.id })
          .from(propertiesTable)
          .where(
            and(
              eq(propertiesTable.id, body.data.propertyId),
              eq(propertiesTable.customerId, existing.customerId),
            ),
          )
          .limit(1)
      )[0];
      if (!prop) {
        res.status(400).json({ error: "property_not_owned_by_customer" });
        return;
      }
    }

    const patch: Partial<ServiceRequest> = {};
    if (body.data.propertyId !== undefined)
      patch.propertyId = body.data.propertyId;
    if (body.data.service !== undefined)
      patch.service = body.data.service as ServiceRequest["service"];
    if (body.data.notes !== undefined) patch.notes = body.data.notes;
    if (body.data.preferredWindowStart !== undefined)
      patch.preferredWindowStart = body.data.preferredWindowStart;
    if (body.data.preferredWindowEnd !== undefined)
      patch.preferredWindowEnd = body.data.preferredWindowEnd;
    if (body.data.status !== undefined)
      patch.status = body.data.status as ServiceRequest["status"];

    if (Object.keys(patch).length === 0) {
      const lead = await loadLeadById(params.data.id, scope);
      if (!lead) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ lead });
      return;
    }
    const [row] = await db
      .update(serviceRequestsTable)
      .set(patch)
      .where(where)
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const lead = await loadLeadById(row.id, scope);
    res.json({ lead });
  },
);

// Convert a lead into a DRAFT quote. Quote is owned by the customer's
// owner_user_id (the sales rep), pre-filled with property + customer, and
// the lead is marked CONVERTED with its convertedQuoteId set so the UI can
// link them later. Idempotent: re-convert returns the existing quote.
router.post(
  "/leads/:id/convert",
  requireAuth,
  requireSection("leads", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = ConvertLeadToQuoteParams.safeParse({
      id: Number(req.params.id),
    });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeServiceRequests(user);
    // First, gate access on scope (with the joined load), so a SALES user
    // can only convert their own leads.
    const visible = await loadLeadById(params.data.id, scope);
    if (!visible) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Now do the actual convert atomically. SELECT ... FOR UPDATE prevents
    // two concurrent converts from each inserting a fresh draft quote.
    try {
      const result = await db.transaction(async (tx) => {
        const locked = (
          await tx
            .select()
            .from(serviceRequestsTable)
            .where(eq(serviceRequestsTable.id, params.data.id))
            .for("update")
            .limit(1)
        )[0];
        if (!locked) return { code: "not_found" as const };

        // Idempotent: if a quote was already attached, return it without
        // creating another.
        if (locked.convertedQuoteId) {
          const existing = (
            await tx
              .select()
              .from(quotesTable)
              .where(eq(quotesTable.id, locked.convertedQuoteId))
              .limit(1)
          )[0];
          if (existing) {
            return { code: "ok" as const, lead: locked, quote: existing };
          }
        }

        const customer = (
          await tx
            .select()
            .from(customersTable)
            .where(eq(customersTable.id, locked.customerId))
            .limit(1)
        )[0];
        if (!customer) return { code: "customer_missing" as const };

        const [quote] = await tx
          .insert(quotesTable)
          .values({
            customerId: customer.id,
            propertyId: locked.propertyId,
            ownerUserId: customer.ownerUserId,
            status: "DRAFT",
            subtotalCents: 0,
            totalCents: 0,
          })
          .returning();

        const [updatedLead] = await tx
          .update(serviceRequestsTable)
          .set({ status: "QUOTED", convertedQuoteId: quote!.id })
          .where(eq(serviceRequestsTable.id, locked.id))
          .returning();

        return { code: "ok" as const, lead: updatedLead!, quote: quote! };
      });

      if (result.code === "not_found") {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (result.code === "customer_missing") {
        res.status(404).json({ error: "customer_missing" });
        return;
      }

      const refreshed = await loadLeadById(result.lead.id, scope);
      res.status(201).json({ lead: refreshed, quote: result.quote });
    } catch (err) {
      req.log?.error({ err }, "convert_lead_failed");
      res.status(500).json({ error: "convert_failed" });
    }
  },
);

export default router;
