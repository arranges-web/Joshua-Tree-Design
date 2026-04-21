import { Router, type IRouter } from "express";
import { db, quotesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";
import { scopeQuotes } from "../lib/rbac/scope";

const router: IRouter = Router();

router.get(
  "/quotes",
  requireAuth,
  requireSection("quotes", "view"),
  async (req, res) => {
    const user = req.user!;
    const where = scopeQuotes(user);
    const query = db.select().from(quotesTable).limit(200);
    const rows = where ? await query.where(where) : await query;
    res.json({ quotes: rows });
  },
);

export default router;
