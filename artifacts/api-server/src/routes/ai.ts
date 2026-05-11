import { Router, type IRouter } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import {
  db,
  customersTable,
  jobsTable,
  quotesTable,
  invoicesTable,
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
  serviceRequestsTable,
  departmentsTable,
  crewsTable,
  usersTable,
  rolesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Lazy-initialize using Replit AI Integrations proxy — no personal API key
// required. Falls back gracefully so the rest of the server still boots.
let openai: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (openai) return openai;
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey  = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) return null;
  openai = new OpenAI({ baseURL, apiKey });
  return openai;
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

/**
 * Build a structured operational snapshot the model can answer
 * questions against. Keep this under ~30k tokens so it stays cheap
 * to send and easy to cache. We summarize counts + recent activity
 * rather than dumping every row.
 */
async function buildOperationalContext(): Promise<string> {
  const NOW = Date.now();
  const DAY = 86_400_000;
  const ytdStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const last30Start = NOW - 30 * DAY;

  const [
    depts,
    customersAgg,
    jobs,
    quotes,
    invoices,
    trucks,
    equipment,
    maintenance,
    serviceRequests,
    crews,
    users,
  ] = await Promise.all([
    db.select().from(departmentsTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customersTable),
    db.select().from(jobsTable),
    db.select().from(quotesTable),
    db.select().from(invoicesTable),
    db.select().from(trucksTable),
    db.select().from(equipmentTable),
    db
      .select()
      .from(maintenanceLogsTable)
      .where(gte(maintenanceLogsTable.performedAt, new Date(NOW - 180 * DAY)))
      .orderBy(desc(maintenanceLogsTable.performedAt)),
    db
      .select()
      .from(serviceRequestsTable)
      .orderBy(desc(serviceRequestsTable.createdAt))
      .limit(50),
    db.select().from(crewsTable),
    db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        roleKey: rolesTable.key,
        deptKey: departmentsTable.key,
        deptLabel: departmentsTable.label,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .innerJoin(
        departmentsTable,
        eq(usersTable.departmentId, departmentsTable.id),
      ),
  ]);

  const deptById = new Map(depts.map((d) => [d.id, d.label] as const));
  const userById = new Map(users.map((u) => [u.id, u] as const));
  const crewById = new Map(crews.map((c) => [c.id, c] as const));

  // Per-dept rollups
  type DeptRow = {
    label: string;
    activeTrucks: number;
    activeEquipment: number;
    crews: number;
    activeMembers: number;
    maintLast30Cents: number;
    maintLast30Count: number;
    maintYtdCents: number;
  };
  const deptStats = new Map<string, DeptRow>();
  for (const d of depts) {
    deptStats.set(d.label, {
      label: d.label,
      activeTrucks: 0,
      activeEquipment: 0,
      crews: 0,
      activeMembers: 0,
      maintLast30Cents: 0,
      maintLast30Count: 0,
      maintYtdCents: 0,
    });
  }
  for (const t of trucks) {
    if (t.status !== "ACTIVE") continue;
    const label = deptById.get(t.departmentId);
    if (label && deptStats.has(label)) deptStats.get(label)!.activeTrucks += 1;
  }
  for (const e of equipment) {
    if (e.status !== "ACTIVE") continue;
    const label = deptById.get(e.departmentId);
    if (label && deptStats.has(label)) deptStats.get(label)!.activeEquipment += 1;
  }
  for (const c of crews) {
    const label = c.departmentId != null ? deptById.get(c.departmentId) : null;
    if (label && deptStats.has(label)) deptStats.get(label)!.crews += 1;
  }
  for (const u of users) {
    if (!u.isActive) continue;
    if (u.deptLabel && deptStats.has(u.deptLabel)) {
      deptStats.get(u.deptLabel)!.activeMembers += 1;
    }
  }
  // Maintenance rolls up by asset's dept
  const truckDept = new Map(trucks.map((t) => [t.id, t.departmentId] as const));
  const equipDept = new Map(equipment.map((e) => [e.id, e.departmentId] as const));
  for (const log of maintenance) {
    let deptId: number | null = null;
    if (log.truckId) deptId = truckDept.get(log.truckId) ?? null;
    else if (log.equipmentId) deptId = equipDept.get(log.equipmentId) ?? null;
    const label = deptId != null ? deptById.get(deptId) : null;
    if (!label || !deptStats.has(label)) continue;
    const ts = new Date(log.performedAt).getTime();
    const cents = log.costCents ?? 0;
    if (ts >= ytdStart) deptStats.get(label)!.maintYtdCents += cents;
    if (ts >= last30Start) {
      deptStats.get(label)!.maintLast30Cents += cents;
      deptStats.get(label)!.maintLast30Count += 1;
    }
  }

  // Job & invoice rollups (org-wide; per-dept gets noisy with crew→lead→dept)
  const jobsByStatus: Record<string, number> = {};
  for (const j of jobs) jobsByStatus[j.status] = (jobsByStatus[j.status] ?? 0) + 1;
  const quotesByStatus: Record<string, { count: number; cents: number }> = {};
  for (const q of quotes) {
    const cur = (quotesByStatus[q.status] ??= { count: 0, cents: 0 });
    cur.count += 1;
    cur.cents += q.totalCents;
  }
  let openInvoiceCents = 0;
  let collectedRevenueCents = 0;
  let overdueOpenCents = 0;
  for (const inv of invoices) {
    if (inv.status === "PAID") collectedRevenueCents += inv.totalCents;
    else {
      openInvoiceCents += inv.totalCents;
      if (inv.issuedAt) {
        const days = Math.floor((NOW - new Date(inv.issuedAt).getTime()) / DAY);
        if (days > 60) overdueOpenCents += inv.totalCents;
      }
    }
  }

  // Open service requests
  const openRequests = serviceRequests.filter(
    (r) => r.status === "NEW" || r.status === "CONTACTED",
  );

  // Recent maintenance logs (top 12 by cost so the ledger feels concrete)
  type MaintenanceLogWithExtras = (typeof maintenance)[number] & {
    vendor?: string | null;
    category?: string | null;
  };
  const topRecentMaintenance = [...(maintenance as MaintenanceLogWithExtras[])]
    .sort((a, b) => (b.costCents ?? 0) - (a.costCents ?? 0))
    .slice(0, 12)
    .map((m) => {
      let asset = "unknown asset";
      if (m.truckId) {
        const t = trucks.find((tt) => tt.id === m.truckId);
        if (t) asset = t.name;
      } else if (m.equipmentId) {
        const e = equipment.find((ee) => ee.id === m.equipmentId);
        if (e) asset = e.name;
      }
      const cents = m.costCents ?? 0;
      const date = new Date(m.performedAt).toISOString().slice(0, 10);
      const vendor = m.vendor ? ` @ ${m.vendor}` : "";
      const category = m.category ? ` [${m.category}]` : "";
      return `${date} | ${asset}${category}${vendor}: ${m.description} — $${(cents / 100).toFixed(2)}`;
    });

  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines: string[] = [];
  lines.push("# Joshua Tree Inc. — operational snapshot");
  lines.push(`Snapshot generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Org-wide");
  lines.push(`- Customers: ${customersAgg[0]?.count ?? 0}`);
  lines.push(`- Open invoices: ${usd(openInvoiceCents)} (overdue 60+ days: ${usd(overdueOpenCents)})`);
  lines.push(`- Collected revenue (lifetime): ${usd(collectedRevenueCents)}`);
  lines.push(`- Active trucks/trailers: ${trucks.filter((t) => t.status === "ACTIVE").length} of ${trucks.length}`);
  lines.push(`- Active equipment: ${equipment.filter((e) => e.status === "ACTIVE").length} of ${equipment.length}`);
  lines.push(`- Open leads (NEW + CONTACTED): ${openRequests.length}`);
  lines.push("");
  lines.push("## Job pipeline");
  for (const [status, count] of Object.entries(jobsByStatus)) {
    lines.push(`- ${status}: ${count}`);
  }
  lines.push("");
  lines.push("## Quote pipeline (count · total $)");
  for (const [status, v] of Object.entries(quotesByStatus)) {
    lines.push(`- ${status}: ${v.count} · ${usd(v.cents)}`);
  }
  lines.push("");
  lines.push("## Per-department");
  for (const dept of depts) {
    const s = deptStats.get(dept.label);
    if (!s) continue;
    lines.push(
      `- ${s.label}: ${s.activeMembers} active members · ${s.crews} crew(s) · ${s.activeTrucks} active truck(s) · ${s.activeEquipment} active equipment · maint last-30d ${usd(s.maintLast30Cents)} (${s.maintLast30Count} log(s)) · maint YTD ${usd(s.maintYtdCents)}`,
    );
  }
  lines.push("");
  lines.push("## Top recent maintenance (last 6 months, by cost)");
  for (const m of topRecentMaintenance) lines.push(`- ${m}`);
  lines.push("");
  lines.push("## Crews (max 12)");
  for (const c of crews.slice(0, 12)) {
    const lead = userById.get(c.leadUserId);
    const deptLabel = c.departmentId != null ? deptById.get(c.departmentId) : "—";
    lines.push(`- ${c.name} (${deptLabel ?? "—"}) — lead: ${lead?.fullName ?? "unknown"}`);
  }
  void crewById;
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are the in-app operations assistant for Joshua Tree Inc., a Florida-based field-services company (tree care, landscaping, lawn, pest, fertilization, sales).

You are talking to admin / accounting staff inside the company's internal admin console. They will ask questions about their own data — customers, jobs, fleet, maintenance, invoices, departments, crews — and may also ask you to draft status reports, weekly summaries, or executive briefings.

A current operational snapshot of the company's database is provided in the user's first message under "OPERATIONAL CONTEXT". Treat that snapshot as the source of truth for any data question. If the snapshot does not contain the answer, say so plainly rather than inventing numbers — the user can always look up the underlying record.

When the user asks for a report or summary, default to a tight executive style:
- Lead with the bottom line: revenue, spend, biggest risks, what changed.
- Use short bulleted sections with USD amounts formatted like \`$1,234\`.
- Group by department when the question is about operations; group by asset type (Trucks / Trailers / Handheld / Custom) when the question is about fleet money.
- Flag anomalies (overdue invoices >60d, money pits, retired-but-active mismatches) explicitly under a "Watch list" heading.

Never reveal raw API keys, passwords, or internal IDs to users — even if the snapshot contains them. Format your responses in clean Markdown. Keep replies under ~600 words unless the user asks for more.`;

router.post(
  "/ai/chat",
  requireAuth,
  async (req, res) => {
    // Gate to ADMIN + ACCOUNTING_MANAGER — these are the only roles
    // expected to ask questions about org-wide data, and limiting the
    // surface keeps token spend predictable.
    const role = req.user?.role;
    if (role !== "ADMIN" && role !== "ACCOUNTING_MANAGER") {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const client = getClient();
    if (!client) {
      res.status(503).json({
        error: "ai_not_configured",
        message: "AI integration is not configured on the server.",
      });
      return;
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    let context: string;
    try {
      context = await buildOperationalContext();
    } catch (err) {
      logger.error({ err }, "Failed to build operational context for AI chat");
      res.status(500).json({ error: "context_build_failed" });
      return;
    }

    // OpenAI chat completions stream `system` + `user`/`assistant`
    // turns as a flat array. We inject the operational snapshot as
    // a second system message so the persona + data context are
    // both pinned at the front of every turn.
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `OPERATIONAL CONTEXT (auto-generated):\n\n${context}`,
      },
      ...parsed.data.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        messages: apiMessages,
      });
      const choice = completion.choices[0];
      logger.info({
        finishReason: choice?.finish_reason,
        contentNull: choice?.message?.content === null,
        contentLength: choice?.message?.content?.length ?? 0,
        refusal: choice?.message?.refusal ?? null,
      }, "AI completion received");
      const reply = choice?.message?.content ?? choice?.message?.refusal ?? "";
      if (!reply) {
        logger.warn({ finishReason: choice?.finish_reason }, "AI model returned empty content — returning retryable error");
        res.status(503).json({
          error: "ai_empty_response",
          message: "The AI model returned an empty response. Please try again.",
        });
        return;
      }
      res.json({
        reply,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      });
    } catch (err) {
      // Distinguish auth + rate-limit so the UI can render a useful
      // hint instead of "something went wrong".
      if (err instanceof OpenAI.AuthenticationError) {
        logger.error({ err }, "OpenAI API key auth failed");
        res.status(503).json({
          error: "ai_auth_failed",
          message: "OPENAI_API_KEY is set but rejected by OpenAI.",
        });
        return;
      }
      if (err instanceof OpenAI.RateLimitError) {
        res.status(429).json({
          error: "ai_rate_limited",
          message: "AI assistant is rate-limited. Try again shortly.",
        });
        return;
      }
      if (err instanceof OpenAI.APIError) {
        logger.error({ err, status: err.status }, "OpenAI API error");
        res.status(502).json({
          error: "ai_upstream_error",
          message: "AI assistant request failed. Please try again.",
        });
        return;
      }
      logger.error({ err }, "AI chat unexpected error");
      res.status(500).json({ error: "ai_unexpected_error" });
    }
  },
);

// `and` is imported for callers extending this file with date-range queries.
void and;

export default router;
