import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  DeleteCustomerParams,
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
