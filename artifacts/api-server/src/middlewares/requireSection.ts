import type { RequestHandler } from "express";
import type { SectionKey } from "@workspace/db";
import { DEFAULT_MATRIX } from "../lib/rbac/matrix";

export type Action = "view" | "edit";

// DB overrides win, otherwise fall back to the in-code default matrix.
export function hasSectionAccess(
  user: { role: keyof typeof DEFAULT_MATRIX; overrides: Record<string, { canView: boolean; canEdit: boolean }> },
  section: SectionKey,
  action: Action,
): boolean {
  const override = user.overrides[section];
  const def = DEFAULT_MATRIX[user.role]?.[section];
  const perm = override ?? def;
  if (!perm) return false;
  return action === "view" ? perm.canView : perm.canEdit;
}

export function requireSection(
  section: SectionKey,
  action: Action = "view",
): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    if (!hasSectionAccess(req.user, section, action)) {
      res.status(403).json({ error: "forbidden", section, action });
      return;
    }
    next();
  };
}
