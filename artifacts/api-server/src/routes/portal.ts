import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { createHash, randomInt } from "node:crypto";
import {
  db,
  customersTable,
  propertiesTable,
  jobsTable,
  crewsTable,
  serviceRequestsTable,
  otpCodesTable,
  type ServiceRequest,
} from "@workspace/db";
import { normalizeToE164 } from "../lib/auth/phone";
import {
  PORTAL_SESSION_COOKIE,
  clearPortalSessionCookieOptions,
  createPortalSession,
  portalSessionCookieOptions,
  revokePortalSessionByToken,
} from "../lib/auth/portalSessions";
import { isTwilioConfigured, sendSms } from "../lib/auth/sms";
import { requirePortalAuth } from "../middlewares/requirePortalAuth";
import { SESSION_COOKIE } from "../lib/auth/sessions";

const router: IRouter = Router();

// ─── Constants ───────────────────────────────────────────────────────────
const OTP_TTL_MS = 1000 * 60 * 5; // 5 min
const OTP_MAX_ATTEMPTS = 5;

function hashOtpCode(phoneE164: string, code: string): string {
  // Salted with the phone so a leaked otp_codes row can't be replayed
  // against a different number.
  return createHash("sha256")
    .update(`${phoneE164}|${code}`)
    .digest("hex");
}

// ─── Rate limiters ───────────────────────────────────────────────────────
// OTP abuse is defended at TWO layers, both of which must pass:
//   1. per-phone bucket — caps SMS sent / verify attempts against a single
//      number (stops targeted credential-stuffing of one customer).
//   2. per-IP bucket    — caps total OTP traffic from a single source
//      (stops a single attacker from rotating phone numbers to
//      SMS-bomb the platform).
// IP-only limits are trivially bypassed by rotating addresses; phone-only
// limits are trivially bypassed by rotating target numbers. Together they
// close both holes.
function phoneRateKey(req: { body?: unknown }): string | null {
  const body = req.body;
  const raw =
    body && typeof body === "object" && "phone" in body
      ? (body as { phone?: unknown }).phone
      : undefined;
  if (typeof raw === "string") {
    const e164 = normalizeToE164(raw);
    if (e164) return e164;
  }
  return null;
}

// Per-phone limiters. Aggressive on OTP request (real SMS costs money),
// looser on verify (legitimate users sometimes mistype).
const otpRequestPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `phone:${phoneRateKey(req) ?? `ip:${req.ip ?? "unknown"}`}`,
  message: { error: "too_many_otp_requests" },
});
const otpVerifyPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `phone:${phoneRateKey(req) ?? `ip:${req.ip ?? "unknown"}`}`,
  message: { error: "too_many_verify_attempts" },
});

// Per-IP ceilings — sized to allow a small office or shared NAT to use
// the portal normally, but to stop a single source from cycling through
// many phone numbers.
const otpRequestIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip ?? "unknown"}`,
  message: { error: "too_many_otp_requests" },
});
const otpVerifyIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip ?? "unknown"}`,
  message: { error: "too_many_verify_attempts" },
});

// ─── Auth: request OTP ───────────────────────────────────────────────────
const requestOtpSchema = z.object({
  phone: z.string().min(1).max(40),
});

router.post(
  "/auth/request-otp",
  otpRequestIpLimiter,
  otpRequestPhoneLimiter,
  async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }
  const e164 = normalizeToE164(parsed.data.phone);
  if (!e164) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }

  // Always issue a code, even if the phone isn't on file. This avoids
  // leaking which numbers are customers; the verify step is what
  // actually grants a session, and verify will return invalid_code if
  // the customer doesn't exist.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(otpCodesTable).values({
    phoneE164: e164,
    codeHash: hashOtpCode(e164, code),
    expiresAt,
  });

  const result = await sendSms({
    toE164: e164,
    body: `Joshua Tree code: ${code}. Expires in 5 minutes.`,
  });

  // DEMO_MODE=true allows the dev-banner OTP fallback even in production.
  // This is intentional for client demonstrations where Twilio is not yet
  // provisioned. Set via environment variable — never hard-coded.
  const isProd = process.env["NODE_ENV"] === "production";
  const isDemoMode = process.env["DEMO_MODE"] === "true";
  const allowDevFallback = !isProd || isDemoMode;

  // Provider was configured but dispatch threw — e.g. bad credentials.
  // In strict production (no DEMO_MODE) surface a real error so the user
  // knows their code won't arrive; in demo / dev mode still surface the
  // code so the demo can proceed.
  if (result.status === "provider_error") {
    if (!allowDevFallback) {
      res.status(502).json({ error: "sms_dispatch_failed" });
      return;
    }
    req.log?.info({ to: e164, code }, `[DEV-OTP] code=${code}`);
    res.json({
      ok: true,
      devMode: true,
      devCode: code,
      message: "Twilio dispatch failed — using OTP printed to the api-server console.",
    });
    return;
  }

  // No provider configured at all (dev / demo). In strict production
  // (no DEMO_MODE) this is a hard failure; in demo / dev, surface the code.
  if (result.status === "dev_console") {
    if (!allowDevFallback) {
      res.status(503).json({ error: "sms_provider_not_configured" });
      return;
    }
    req.log?.info({ to: e164, code }, `[DEV-OTP] code=${code}`);
    res.json({
      ok: true,
      devMode: true,
      devCode: code,
      message: isDemoMode
        ? "Demo mode — OTP displayed in banner. (Configure Twilio to send real SMS.)"
        : "Twilio not configured — OTP printed to api-server console.",
    });
    return;
  }

  res.json({ ok: true, devMode: !isTwilioConfigured() });
});

// ─── Auth: verify OTP ────────────────────────────────────────────────────
const verifyOtpSchema = z.object({
  phone: z.string().min(1).max(40),
  code: z.string().regex(/^\d{6}$/),
});

router.post(
  "/auth/verify-otp",
  otpVerifyIpLimiter,
  otpVerifyPhoneLimiter,
  async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  const e164 = normalizeToE164(parsed.data.phone);
  if (!e164) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }

  // Look up the most recent unconsumed code for this phone that hasn't
  // expired. A single phone can have several outstanding codes if the
  // user hit "Resend"; we accept any of them as long as it matches.
  const candidates = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.phoneE164, e164),
        isNull(otpCodesTable.consumedAt),
        gt(otpCodesTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodesTable.createdAt))
    .limit(5);

  if (candidates.length === 0) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }

  const targetHash = hashOtpCode(e164, parsed.data.code);
  const match = candidates.find((c) => c.codeHash === targetHash);

  if (!match) {
    // Bump attempts on the newest candidate, lock it if too many.
    const newest = candidates[0]!;
    const attempts = newest.attempts + 1;
    await db
      .update(otpCodesTable)
      .set({
        attempts,
        // Burning the code prevents brute-force after MAX attempts.
        consumedAt: attempts >= OTP_MAX_ATTEMPTS ? new Date() : null,
      })
      .where(eq(otpCodesTable.id, newest.id));
    res.status(400).json({ error: "invalid_code" });
    return;
  }

  // Burn the matched code so it can't be reused, even before we mint
  // the session — keeps verify idempotent under concurrent requests.
  await db
    .update(otpCodesTable)
    .set({ consumedAt: new Date() })
    .where(eq(otpCodesTable.id, match.id));

  // The phone has to map to an existing customer. If it doesn't, return
  // the same generic `invalid_code` error we use for code mismatches —
  // never reveal whether a number is on file. The OTP was already burned
  // above, so callers can't probe by replaying the same code.
  const customer = (
    await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.phoneE164, e164))
      .limit(1)
  )[0];
  if (!customer) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }

  const { token, expiresAt } = await createPortalSession({
    customerId: customer.id,
    userAgent: req.get("user-agent") ?? null,
    ip: req.ip ?? null,
  });

  // Defense in depth: if a stale staff cookie is sitting in the browser,
  // wipe it on portal login so the user can't accidentally hold both.
  res.cookie(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    signed: true,
    path: "/",
    maxAge: 0,
  });
  res.cookie(PORTAL_SESSION_COOKIE, token, portalSessionCookieOptions(expiresAt));
  res.json({
    customer: shapeCustomer(customer),
  });
});

// ─── Auth: logout ────────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res) => {
  const token = req.signedCookies?.[PORTAL_SESSION_COOKIE] as string | undefined;
  if (token) await revokePortalSessionByToken(token);
  res.cookie(PORTAL_SESSION_COOKIE, "", clearPortalSessionCookieOptions());
  res.json({ ok: true });
});

// ─── Auth: me ────────────────────────────────────────────────────────────
router.get("/me", requirePortalAuth, (req, res) => {
  res.json({ customer: shapeCustomer(req.customer!) });
});

// ─── Data: properties ────────────────────────────────────────────────────
router.get("/properties", requirePortalAuth, async (req, res) => {
  const customer = req.customer!;
  const properties = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.customerId, customer.id))
    .orderBy(asc(propertiesTable.id));
  res.json({ properties });
});

// ─── Data: jobs (split upcoming / past) ──────────────────────────────────
router.get("/jobs", requirePortalAuth, async (req, res) => {
  const customer = req.customer!;
  const properties = await db
    .select({ id: propertiesTable.id, address: propertiesTable.address })
    .from(propertiesTable)
    .where(eq(propertiesTable.customerId, customer.id));
  const propIds = properties.map((p) => p.id);
  if (propIds.length === 0) {
    res.json({ upcoming: [], past: [], crews: [] });
    return;
  }
  const propAddrById = new Map(properties.map((p) => [p.id, p.address]));

  const allJobs = await db
    .select({
      id: jobsTable.id,
      propertyId: jobsTable.propertyId,
      crewId: jobsTable.crewId,
      status: jobsTable.status,
      scheduledFor: jobsTable.scheduledFor,
      completedAt: jobsTable.completedAt,
      totalCents: jobsTable.totalCents,
      notes: jobsTable.notes,
      createdAt: jobsTable.createdAt,
    })
    .from(jobsTable)
    .where(inArray(jobsTable.propertyId, propIds));

  const upcomingRaw = allJobs.filter(
    (j) => j.status !== "COMPLETE" && j.status !== "CANCELLED",
  );
  const pastRaw = allJobs.filter(
    (j) => j.status === "COMPLETE" || j.status === "CANCELLED",
  );
  upcomingRaw.sort(
    (a, b) =>
      (a.scheduledFor?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (b.scheduledFor?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );
  pastRaw.sort(
    (a, b) =>
      (b.completedAt?.getTime() ?? b.createdAt.getTime()) -
      (a.completedAt?.getTime() ?? a.createdAt.getTime()),
  );

  const crewIds = Array.from(
    new Set(allJobs.map((j) => j.crewId).filter((id): id is number => id != null)),
  );
  const crewRows = crewIds.length
    ? await db
        .select({ id: crewsTable.id, name: crewsTable.name })
        .from(crewsTable)
        .where(inArray(crewsTable.id, crewIds))
    : [];
  const crewNameById = new Map(crewRows.map((c) => [c.id, c.name]));

  const decorate = (j: typeof allJobs[number]) => ({
    ...j,
    propertyAddress: propAddrById.get(j.propertyId) ?? null,
    crewName: j.crewId != null ? crewNameById.get(j.crewId) ?? null : null,
  });

  res.json({
    upcoming: upcomingRaw.map(decorate),
    past: pastRaw.map(decorate),
    crews: crewRows,
  });
});

// ─── Data: requests (list own) ───────────────────────────────────────────
router.get("/requests", requirePortalAuth, async (req, res) => {
  const customer = req.customer!;
  const rows = await db
    .select({
      lead: serviceRequestsTable,
      propertyAddress: propertiesTable.address,
    })
    .from(serviceRequestsTable)
    .leftJoin(
      propertiesTable,
      eq(serviceRequestsTable.propertyId, propertiesTable.id),
    )
    .where(eq(serviceRequestsTable.customerId, customer.id))
    .orderBy(desc(serviceRequestsTable.createdAt));
  res.json({
    requests: rows.map((r) => ({
      ...r.lead,
      propertyAddress: r.propertyAddress,
    })),
  });
});

// ─── Data: create new service request ────────────────────────────────────
const createRequestSchema = z.object({
  service: z.enum([
    "TREE_REMOVAL",
    "TRIMMING_PRUNING",
    "MANGROVE_CARE",
    "STUMP_GRINDING",
    "EMERGENCY_STORM",
    "CRANE_ASSISTED",
  ]),
  propertyId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  preferredWindowStart: z.string().datetime().nullable().optional(),
  preferredWindowEnd: z.string().datetime().nullable().optional(),
});

router.post("/requests", requirePortalAuth, async (req, res) => {
  const customer = req.customer!;
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  // IDOR guard: a propertyId, if supplied, must belong to this customer.
  if (parsed.data.propertyId != null) {
    const ownsProp = (
      await db
        .select({ id: propertiesTable.id })
        .from(propertiesTable)
        .where(
          and(
            eq(propertiesTable.id, parsed.data.propertyId),
            eq(propertiesTable.customerId, customer.id),
          ),
        )
        .limit(1)
    )[0];
    if (!ownsProp) {
      res.status(400).json({ error: "property_not_owned" });
      return;
    }
  }

  const [row] = await db
    .insert(serviceRequestsTable)
    .values({
      customerId: customer.id,
      propertyId: parsed.data.propertyId ?? null,
      service: parsed.data.service as ServiceRequest["service"],
      notes: parsed.data.notes ?? null,
      preferredWindowStart: parsed.data.preferredWindowStart
        ? new Date(parsed.data.preferredWindowStart)
        : null,
      preferredWindowEnd: parsed.data.preferredWindowEnd
        ? new Date(parsed.data.preferredWindowEnd)
        : null,
      status: "NEW",
      source: "PORTAL",
    })
    .returning();

  // Hydrate the propertyAddress for the response so the UI doesn't
  // need a second round-trip.
  let propertyAddress: string | null = null;
  if (row!.propertyId) {
    const p = (
      await db
        .select({ address: propertiesTable.address })
        .from(propertiesTable)
        .where(eq(propertiesTable.id, row!.propertyId))
        .limit(1)
    )[0];
    propertyAddress = p?.address ?? null;
  }

  res.status(201).json({
    request: { ...row!, propertyAddress },
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────
function shapeCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phoneE164: c.phoneE164,
    billingAddress: c.billingAddress,
  };
}

export default router;
