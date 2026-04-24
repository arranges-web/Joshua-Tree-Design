import { useMemo, useState } from "react";
import {
  useGetPermissionMatrix,
  useUpdateSectionPermission,
  getGetPermissionMatrixQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Pencil, Ban, ShieldCheck, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type AccessLevel = "none" | "view" | "edit";

function toAccessLevel(canView: boolean, canEdit: boolean): AccessLevel {
  if (canEdit) return "edit";
  if (canView) return "view";
  return "none";
}

function fromAccessLevel(level: AccessLevel): {
  canView: boolean;
  canEdit: boolean;
} {
  if (level === "edit") return { canView: true, canEdit: true };
  if (level === "view") return { canView: true, canEdit: false };
  return { canView: false, canEdit: false };
}

function nextLevel(current: AccessLevel): AccessLevel {
  if (current === "none") return "view";
  if (current === "view") return "edit";
  return "none";
}

const SECTION_META: Record<
  string,
  { label: string; description: string; group: string }
> = {
  "dashboard.global": {
    label: "Dashboard",
    description: "Company-wide KPI overview and activity feed",
    group: "General",
  },
  customers: {
    label: "Customers",
    description: "Customer profiles, properties, and contact history",
    group: "General",
  },
  jobs: {
    label: "Jobs",
    description: "Work orders from scheduling through completion",
    group: "General",
  },
  quotes: {
    label: "Quotes",
    description: "Price estimates and proposal management",
    group: "Sales",
  },
  invoices: {
    label: "Invoices",
    description: "Billing, payments, and accounts receivable",
    group: "Sales",
  },
  "sales.calendar": {
    label: "Sales Calendar",
    description: "Appointments, follow-ups, and sales scheduling",
    group: "Sales",
  },
  leads: {
    label: "Leads",
    description: "Inbound inquiries and new prospect pipeline",
    group: "Sales",
  },
  "reports.financials": {
    label: "Financial Reports",
    description: "Revenue, margin, and financial performance data",
    group: "Sales",
  },
  "fleet.trucks": {
    label: "Trucks",
    description: "Truck fleet roster, status, and assignments",
    group: "Fleet & Shop",
  },
  "fleet.equipment": {
    label: "Equipment",
    description: "Tools and equipment inventory",
    group: "Fleet & Shop",
  },
  "fleet.maintenance": {
    label: "Maintenance",
    description: "Service records and scheduled maintenance",
    group: "Fleet & Shop",
  },
  "field.job_site": {
    label: "Job Site",
    description: "On-site checklists and work instructions",
    group: "Field Crew",
  },
  "field.photos": {
    label: "Site Photos",
    description: "Before/after and progress photo capture",
    group: "Field Crew",
  },
  "field.safety": {
    label: "Safety",
    description: "Hazard reports and safety compliance forms",
    group: "Field Crew",
  },
  "admin.users": {
    label: "Users",
    description: "Employee accounts and role assignments",
    group: "People & Access",
  },
  "admin.permissions": {
    label: "Permissions",
    description: "Role-based access control configuration",
    group: "People & Access",
  },
};

const GROUP_ORDER = [
  "General",
  "Sales",
  "Fleet & Shop",
  "Field Crew",
  "People & Access",
];

function sectionMeta(key: string) {
  return (
    SECTION_META[key] ?? {
      label: key,
      description: "",
      group: "Other",
    }
  );
}

const ACCESS_CONFIG = {
  none: {
    label: "No Access",
    icon: Ban,
    className:
      "bg-muted text-muted-foreground hover:bg-muted/60",
  },
  view: {
    label: "View",
    icon: Eye,
    className:
      "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300",
  },
  edit: {
    label: "Edit",
    icon: Pencil,
    className:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
} as const;

function AccessBadge({
  level,
  onClick,
  disabled,
  isOverride,
}: {
  level: AccessLevel;
  onClick: () => void;
  disabled: boolean;
  isOverride: boolean;
}) {
  const config = ACCESS_CONFIG[level];
  const Icon = config.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        config.className,
        isOverride && "ring-1 ring-offset-1 ring-amber-400 dark:ring-amber-500",
      )}
      title={
        isOverride
          ? "Custom override · click to cycle: No Access → View → Edit"
          : "Click to cycle: No Access → View → Edit"
      }
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </button>
  );
}

export function Permissions() {
  const { data, isLoading } = useGetPermissionMatrix();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateSectionPermission();
  const [saved, setSaved] = useState(false);

  const roles = useMemo(
    () =>
      (data?.roles ?? [])
        .filter((r) => r?.key)
        .map((r) => ({ id: r.id, key: r.key, label: r.label })),
    [data?.roles],
  );

  const sections = (data?.sections ?? []).filter(Boolean);
  const cells = data?.cells ?? [];

  const cellMap = useMemo(() => {
    const m = new Map<
      string,
      { canView: boolean; canEdit: boolean; isOverride: boolean }
    >();
    for (const c of cells) {
      m.set(`${c.roleKey}::${c.sectionKey}`, {
        canView: c.canView,
        canEdit: c.canEdit,
        isOverride: c.isOverride,
      });
    }
    return m;
  }, [cells]);

  const getCell = (roleKey: string, sectionKey: string) =>
    cellMap.get(`${roleKey}::${sectionKey}`) ?? {
      canView: false,
      canEdit: false,
      isOverride: false,
    };

  const apply = (
    roleKey: string,
    sectionKey: string,
    canView: boolean,
    canEdit: boolean,
  ) => {
    updateMutation.mutate(
      { data: { roleKey, sectionKey, canView, canEdit } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetPermissionMatrixQueryKey(),
          });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: () =>
          toast({ title: "Couldn't save change", variant: "destructive" }),
      },
    );
  };

  const cycleCell = (roleKey: string, sectionKey: string) => {
    const cell = getCell(roleKey, sectionKey);
    const next = fromAccessLevel(nextLevel(toAccessLevel(cell.canView, cell.canEdit)));
    apply(roleKey, sectionKey, next.canView, next.canEdit);
  };

  const bulkApply = (roleKey: string, level: AccessLevel) => {
    const { canView, canEdit } = fromAccessLevel(level);
    for (const s of sections) {
      apply(roleKey, s, canView, canEdit);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const s of sections) {
      const group = sectionMeta(s).group;
      if (!g.has(group)) g.set(group, []);
      g.get(group)!.push(s);
    }
    const ordered: Array<[string, string[]]> = [];
    for (const grp of GROUP_ORDER) {
      if (g.has(grp)) ordered.push([grp, g.get(grp)!]);
    }
    for (const [k, v] of g) {
      if (!GROUP_ORDER.includes(k)) ordered.push([k, v]);
    }
    return ordered;
  }, [sections]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl">Permissions</h1>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || roles.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl">Permissions</h1>
        <p className="text-sm text-destructive">
          Failed to load permissions matrix. Check API connection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Access Control
          </div>
          <h1 className="font-serif text-3xl">Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a role to see and adjust what it can access. Click any badge
            to cycle through No Access → View → Edit.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs">
          {saved ? (
            <>
              <CheckCheck className="h-4 w-4 text-emerald-500" />
              <span className="font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Saved
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Auto-saves
              </span>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue={roles[0]?.key} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          {roles.map((role) => (
            <TabsTrigger
              key={role.key}
              value={role.key}
              className="px-5 py-2 text-sm font-medium"
            >
              {role.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {roles.map((role) => (
          <TabsContent key={role.key} value={role.key} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
              <span className="mr-1 text-xs font-medium text-muted-foreground">
                Bulk set all sections:
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-3 text-xs"
                disabled={updateMutation.isPending}
                onClick={() => bulkApply(role.key, "edit")}
              >
                <Pencil className="h-3 w-3" />
                Full Access
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-3 text-xs"
                disabled={updateMutation.isPending}
                onClick={() => bulkApply(role.key, "view")}
              >
                <Eye className="h-3 w-3" />
                View Only
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-3 text-xs text-muted-foreground"
                disabled={updateMutation.isPending}
                onClick={() => bulkApply(role.key, "none")}
              >
                <Ban className="h-3 w-3" />
                No Access
              </Button>
            </div>

            <div className="space-y-4">
              {grouped.map(([groupLabel, groupSections]) => (
                <div
                  key={groupLabel}
                  className="overflow-hidden rounded-lg border bg-card shadow-sm"
                >
                  <div className="border-b bg-muted/40 px-4 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {groupLabel}
                    </span>
                  </div>
                  <div className="divide-y">
                    {groupSections.map((section) => {
                      const meta = sectionMeta(section);
                      const cell = getCell(role.key, section);
                      const level = toAccessLevel(cell.canView, cell.canEdit);
                      return (
                        <div
                          key={section}
                          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/20"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {meta.label}
                            </div>
                            {meta.description && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {meta.description}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            <AccessBadge
                              level={level}
                              onClick={() => cycleCell(role.key, section)}
                              disabled={updateMutation.isPending}
                              isOverride={cell.isOverride}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
              <span className="inline-flex h-3 w-3 shrink-0 rounded-full bg-amber-50 ring-1 ring-amber-400 dark:bg-amber-900/20 dark:ring-amber-500" />
              <span>Amber ring indicates a custom override from the role default.</span>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
