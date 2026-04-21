import type { RoleKey } from "@workspace/db";
import { ROLE_KEYS, SECTION_KEYS, type SectionKey } from "@workspace/db";

export type Permission = { canView: boolean; canEdit: boolean };

// Default permission matrix. This is the source of truth at boot time —
// rows are mirrored to the `section_permissions` table on first run.
// Any admin override stored in DB wins at runtime.
export const DEFAULT_MATRIX: Record<RoleKey, Record<SectionKey, Permission>> = {
  ADMIN: Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { canView: true, canEdit: true }]),
  ) as Record<SectionKey, Permission>,

  SALES: {
    "dashboard.global": { canView: false, canEdit: false },
    customers: { canView: true, canEdit: true },
    jobs: { canView: true, canEdit: false },
    quotes: { canView: true, canEdit: true },
    invoices: { canView: false, canEdit: false },
    "fleet.trucks": { canView: false, canEdit: false },
    "fleet.equipment": { canView: false, canEdit: false },
    "fleet.maintenance": { canView: false, canEdit: false },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: false, canEdit: false },
    "field.photos": { canView: false, canEdit: false },
    "field.safety": { canView: false, canEdit: false },
    "sales.calendar": { canView: true, canEdit: true },
    "reports.financials": { canView: false, canEdit: false },
  },

  CREW_LEAD: {
    "dashboard.global": { canView: false, canEdit: false },
    customers: { canView: false, canEdit: false },
    jobs: { canView: true, canEdit: true },
    quotes: { canView: false, canEdit: false },
    invoices: { canView: false, canEdit: false },
    "fleet.trucks": { canView: false, canEdit: false },
    "fleet.equipment": { canView: false, canEdit: false },
    "fleet.maintenance": { canView: false, canEdit: false },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: true, canEdit: true },
    "field.photos": { canView: true, canEdit: true },
    "field.safety": { canView: true, canEdit: true },
    "sales.calendar": { canView: false, canEdit: false },
    "reports.financials": { canView: false, canEdit: false },
  },

  MECHANIC: {
    "dashboard.global": { canView: false, canEdit: false },
    customers: { canView: false, canEdit: false },
    jobs: { canView: false, canEdit: false },
    quotes: { canView: false, canEdit: false },
    invoices: { canView: false, canEdit: false },
    "fleet.trucks": { canView: true, canEdit: true },
    "fleet.equipment": { canView: true, canEdit: true },
    "fleet.maintenance": { canView: true, canEdit: true },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: false, canEdit: false },
    "field.photos": { canView: false, canEdit: false },
    "field.safety": { canView: false, canEdit: false },
    "sales.calendar": { canView: false, canEdit: false },
    "reports.financials": { canView: false, canEdit: false },
  },
};

// Sanity check at module load (caught by typecheck if missing keys)
for (const role of ROLE_KEYS) {
  for (const section of SECTION_KEYS) {
    if (!DEFAULT_MATRIX[role][section]) {
      throw new Error(
        `Missing default permission for role=${role} section=${section}`,
      );
    }
  }
}
