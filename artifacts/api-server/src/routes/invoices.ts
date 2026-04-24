import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, invoicesTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";

const router: IRouter = Router();

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

function coerceInvoiceInput<
  T extends {
    status?: string;
    issuedAt?: string | Date | null;
    paidAt?: string | Date | null;
  },
>(input: T) {
  return {
    ...input,
    status: input.status as InvoiceStatus | undefined,
    issuedAt:
      typeof input.issuedAt === "string"
        ? new Date(input.issuedAt)
        : (input.issuedAt ?? null),
    paidAt:
      typeof input.paidAt === "string"
        ? new Date(input.paidAt)
        : (input.paidAt ?? null),
  };
}

router.get(
  "/invoices",
  requireAuth,
  requireSection("invoices", "view"),
  async (_req, res) => {
    const rows = await db.select().from(invoicesTable).limit(500);
    res.json({ invoices: rows });
  },
);

router.post(
  "/invoices",
  requireAuth,
  requireSection("invoices", "edit"),
  async (req, res) => {
    const parsed = CreateInvoiceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const [row] = await db
      .insert(invoicesTable)
      .values(coerceInvoiceInput(parsed.data))
      .returning();
    res.status(201).json({ invoice: row });
  },
);

router.patch(
  "/invoices/:id",
  requireAuth,
  requireSection("invoices", "edit"),
  async (req, res) => {
    const params = UpdateInvoiceParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateInvoiceBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const [row] = await db
      .update(invoicesTable)
      .set(coerceInvoiceInput(body.data))
      .where(eq(invoicesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ invoice: row });
  },
);

router.delete(
  "/invoices/:id",
  requireAuth,
  requireSection("invoices", "edit"),
  async (req, res) => {
    const params = DeleteInvoiceParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const deleted = await db
      .delete(invoicesTable)
      .where(eq(invoicesTable.id, params.data.id))
      .returning({ id: invoicesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
