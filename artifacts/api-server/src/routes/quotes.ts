import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, quotesTable } from "@workspace/db";
import {
  CreateQuoteBody,
  UpdateQuoteBody,
  UpdateQuoteParams,
  DeleteQuoteParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import { scopeQuotes } from "../lib/rbac/scope";

const router: IRouter = Router();

type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

function coerceQuoteInput<
  T extends {
    status?: string;
    sentAt?: string | Date | null;
    decidedAt?: string | Date | null;
  },
>(input: T) {
  return {
    ...input,
    status: input.status as QuoteStatus | undefined,
    sentAt:
      typeof input.sentAt === "string"
        ? new Date(input.sentAt)
        : (input.sentAt ?? null),
    decidedAt:
      typeof input.decidedAt === "string"
        ? new Date(input.decidedAt)
        : (input.decidedAt ?? null),
  };
}

router.get(
  "/quotes",
  requireAuth,
  requireSection("quotes", "view"),
  async (req, res) => {
    const user = req.user!;
    const where = scopeQuotes(user);
    const query = db.select().from(quotesTable).limit(500);
    const rows = where ? await query.where(where) : await query;
    res.json({ quotes: rows });
  },
);

router.post(
  "/quotes",
  requireAuth,
  requireSection("quotes", "edit"),
  async (req, res) => {
    const parsed = CreateQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const [row] = await db
      .insert(quotesTable)
      .values(coerceQuoteInput(parsed.data))
      .returning();
    res.status(201).json({ quote: row });
  },
);

router.patch(
  "/quotes/:id",
  requireAuth,
  requireSection("quotes", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = UpdateQuoteParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateQuoteBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeQuotes(user);
    const where = scope
      ? and(eq(quotesTable.id, params.data.id), scope)
      : eq(quotesTable.id, params.data.id);
    const [row] = await db
      .update(quotesTable)
      .set(coerceQuoteInput(body.data))
      .where(where)
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ quote: row });
  },
);

router.delete(
  "/quotes/:id",
  requireAuth,
  requireSection("quotes", "edit"),
  async (req, res) => {
    const user = req.user!;
    const params = DeleteQuoteParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const scope = scopeQuotes(user);
    const where = scope
      ? and(eq(quotesTable.id, params.data.id), scope)
      : eq(quotesTable.id, params.data.id);
    const deleted = await db
      .delete(quotesTable)
      .where(where)
      .returning({ id: quotesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
