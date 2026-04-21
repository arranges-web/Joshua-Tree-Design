import { randomBytes } from "node:crypto";
import { logger } from "../logger";

let cached: string | undefined;

/**
 * Returns the secret used to sign session cookies and HMAC other tokens.
 * Production MUST set SESSION_SECRET. In development we generate a stable
 * per-process random secret and warn loudly so it isn't shipped to prod.
 */
export function getSessionSecret(): string {
  if (cached) return cached;
  const fromEnv = process.env["SESSION_SECRET"];
  if (fromEnv && fromEnv.length >= 32) {
    cached = fromEnv;
    return cached;
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "SESSION_SECRET must be set in production (>=32 chars).",
    );
  }
  cached = randomBytes(48).toString("hex");
  logger.warn(
    "SESSION_SECRET not set — generated an ephemeral dev secret. " +
      "Set SESSION_SECRET (>=32 chars) before deploying.",
  );
  return cached;
}
