/**
 * Demo-mode predicate. Several backfill steps seed synthetic
 * customers, jobs, trucks, equipment, and maintenance receipts so
 * the published Joshua Tree console shows a populated dashboard. We
 * still want a single switch to disable that on a real customer DB.
 *
 * Truthy in any of these cases:
 *   - DEMO_MODE env var is "true" / "1" / "yes" (Replit's
 *     production environment sets this via .replit's
 *     [userenv.production] block).
 *   - NODE_ENV is not "production" — so local dev and CI always seed.
 *
 * Falsy when DEMO_MODE is explicitly "false" / "0" / "no", giving
 * operators a hard kill switch even in non-production environments.
 */
export function isDemoMode(): boolean {
  const raw = (process.env["DEMO_MODE"] ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  return process.env["NODE_ENV"] !== "production";
}
