import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  db,
  usersTable,
  rolesTable,
  departmentsTable,
  sectionPermissionsTable,
  type RoleKey,
  type DepartmentKey,
} from "@workspace/db";
import { findSessionByToken, SESSION_COOKIE } from "../lib/auth/sessions";

export interface AuthenticatedUser {
  id: number;
  email: string;
  fullName: string;
  role: RoleKey;
  roleId: number;
  department: DepartmentKey;
  departmentId: number;
  isActive: boolean;
  // Per-role overrides, indexed by section_key. If a key is absent, the
  // default matrix from rbac/matrix.ts wins.
  overrides: Record<string, { canView: boolean; canEdit: boolean }>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token =
    (req.signedCookies?.[SESSION_COOKIE] as string | undefined) ??
    extractBearer(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const session = await findSessionByToken(token);
  if (!session) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      roleId: rolesTable.id,
      roleKey: rolesTable.key,
      departmentId: departmentsTable.id,
      departmentKey: departmentsTable.key,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .innerJoin(
      departmentsTable,
      eq(usersTable.departmentId, departmentsTable.id),
    )
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const overrideRows = await db
    .select()
    .from(sectionPermissionsTable)
    .where(eq(sectionPermissionsTable.roleId, row.roleId));

  const overrides: AuthenticatedUser["overrides"] = {};
  for (const o of overrideRows) {
    overrides[o.sectionKey] = { canView: o.canView, canEdit: o.canEdit };
  }

  req.user = {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    isActive: row.isActive,
    role: row.roleKey as RoleKey,
    roleId: row.roleId,
    department: row.departmentKey as DepartmentKey,
    departmentId: row.departmentId,
    overrides,
  };

  next();
};

function extractBearer(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim() || undefined;
}
