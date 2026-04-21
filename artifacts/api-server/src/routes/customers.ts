import { Router, type IRouter } from "express";
import { db, customersTable } from "@workspace/db";
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
    const query = db.select().from(customersTable).limit(200);
    const rows = where ? await query.where(where) : await query;
    res.json({ customers: rows.map((r) => shapeCustomerForRole(r, user.role)) });
  },
);

export default router;
