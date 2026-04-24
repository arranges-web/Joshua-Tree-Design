import { logger } from "../logger";

// Twilio dispatcher. The task explicitly ships dev-mode (console OTP) by
// default, and only flips to real SMS if a Twilio connection is wired up
// (either via the Replit connector or via raw env vars). The runtime
// detection makes that switch zero-touch — no code change required when
// the connection is added later.
export interface SendSmsOpts {
  toE164: string;
  body: string;
}

export type SendSmsOutcome =
  | { status: "delivered"; provider: "twilio" }
  | { status: "dev_console"; provider: "dev_console" }
  | { status: "provider_error"; provider: "twilio"; error: unknown };

export async function sendSms({
  toE164,
  body,
}: SendSmsOpts): Promise<SendSmsOutcome> {
  const creds = await loadTwilioCreds();
  if (!creds) {
    // No provider wired up at all → caller must surface the dev fallback
    // (console + dev banner). In production this should not happen
    // because deployment should require the connector.
    logger.warn(
      { to: toE164, body },
      "[DEV-OTP] No Twilio connection configured — printing SMS to console.",
    );
    return { status: "dev_console", provider: "dev_console" };
  }

  try {
    await postTwilioMessage(creds, toE164, body);
    logger.info({ to: toE164 }, "Twilio SMS dispatched");
    return { status: "delivered", provider: "twilio" };
  } catch (err) {
    // Provider was configured but actual dispatch failed. Caller decides
    // how to surface this — production must NOT pretend the message was
    // sent (the user would be locked out with no code).
    logger.error(
      { err, to: toE164 },
      "Twilio dispatch failed.",
    );
    return { status: "provider_error", provider: "twilio", error: err };
  }
}

interface TwilioCreds {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

async function loadTwilioCreds(): Promise<TwilioCreds | null> {
  // 1. Replit Connectors API (REQUIRED PRIMARY PATH).
  // Per the architectural constraint, Twilio is wired through Replit's
  // managed connector flow — that's how the user provisions credentials
  // from the Integrations panel. Resolved at request time so no token
  // caching, per the integrations skill guidance.
  const host = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const identity = process.env["REPL_IDENTITY"] ?? process.env["WEB_REPL_RENEWAL"];
  if (host && identity) {
    try {
      const url = `https://${host}/api/v2/connection?include_secrets=true&connector_names=twilio`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: identity,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          items?: Array<{ settings?: Record<string, unknown> }>;
        };
        const settings = data.items?.[0]?.settings ?? null;
        if (settings) {
          const accountSid =
            (settings["account_sid"] as string | undefined) ??
            (settings["accountSid"] as string | undefined);
          const authToken =
            (settings["auth_token"] as string | undefined) ??
            (settings["authToken"] as string | undefined);
          const fromNumber =
            (settings["phone_number"] as string | undefined) ??
            (settings["from_number"] as string | undefined) ??
            (settings["fromNumber"] as string | undefined);
          if (accountSid && authToken && fromNumber) {
            return { accountSid, authToken, fromNumber };
          }
        }
      }
    } catch {
      // fall through to the env-var escape hatch below
    }
  }

  // 2. Raw env-var escape hatch — only used for local development /
  // CI environments where the Replit connector isn't reachable. The
  // connector path above is the production source of truth.
  const envSid = process.env["TWILIO_ACCOUNT_SID"];
  const envToken = process.env["TWILIO_AUTH_TOKEN"];
  const envFrom = process.env["TWILIO_PHONE_NUMBER"] ?? process.env["TWILIO_FROM"];
  if (envSid && envToken && envFrom) {
    return { accountSid: envSid, authToken: envToken, fromNumber: envFrom };
  }

  return null;
}

async function postTwilioMessage(
  creds: TwilioCreds,
  toE164: string,
  body: string,
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    creds.accountSid,
  )}/Messages.json`;
  const params = new URLSearchParams();
  params.set("To", toE164);
  params.set("From", creds.fromNumber);
  params.set("Body", body);
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString(
    "base64",
  );
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`twilio_http_${res.status}: ${text.slice(0, 200)}`);
  }
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    (process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      (process.env["TWILIO_PHONE_NUMBER"] ?? process.env["TWILIO_FROM"])) ||
      (process.env["REPLIT_CONNECTORS_HOSTNAME"] &&
        (process.env["REPL_IDENTITY"] ?? process.env["WEB_REPL_RENEWAL"])),
  );
}
