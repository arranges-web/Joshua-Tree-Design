import type { RequestHandler } from "express";
import type { RoleKey } from "@workspace/db";

export function requireRole(...roles: RoleKey[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", required: roles });
      return;
    }
    next();
  };
}
