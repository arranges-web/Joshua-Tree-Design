import { useMemo } from "react";
import {
  useGetPermissionMatrix,
  useUpdateSectionPermission,
  getGetPermissionMatrixQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, ShieldCheck, Ban } from "lucide-react";

function formatLabel(key: string) {
  return key
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function sectionGroupLabel(key: string) {
  const prefix = key.split(".")[0];
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    customers: "Customers",
    jobs: "Jobs",
    quotes: "Quotes",
    invoices: "Invoices",
    fleet: "Fleet & Shop",
    admin: "People & Access",
    field: "Field Crew",
    sales: "Sales",
    reports: "Reports",
  };
  return map[prefix] ?? formatLabel(prefix);
}

interface CellState {
  canView: boolean;
  canEdit: boolean;
}

export function Permissions() {
  const { data, isLoading } = useGetPermissionMatrix();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateSectionPermission();

  const apply = (
    roleKey: string,
    sectionKey: string,
    next: CellState,
  ) => {
    updateMutation.mutate(
      { data: { roleKey, sectionKey, ...next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetPermissionMatrixQueryKey(),
          });
        },
        onError: () =>
          toast({
            title: "Couldn't save change",
            variant: "destructive",
          }),
      },
    );
  };

  const roles = useMemo(
    () =>
      (data?.roles ?? []).map((r) => ({
        key: r.key,
        label: r.label || formatLabel(r.key),
      })),
    [data?.roles],
  );
  const sections = data?.sections ?? [];
  const cells = data?.cells ?? [];

  const cellMap = useMemo(() => {
    const m = new Map<string, CellState>();
    for (const c of cells) {
      m.set(`${c.roleKey}::${c.sectionKey}`, {
        canView: c.canView,
        canEdit: c.canEdit,
      });
    }
    return m;
  }, [cells]);

  const getCell = (roleKey: string, sectionKey: string): CellState =>
    cellMap.get(`${roleKey}::${sectionKey}`) ?? {
      canView: false,
      canEdit: false,
    };

  const grouped = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const s of sections) {
      const label = sectionGroupLabel(s);
      if (!g.has(label)) g.set(label, []);
      g.get(label)!.push(s);
    }
    return Array.from(g.entries());
  }, [sections]);

  const setRow = (sectionKey: string, mode: "view" | "edit" | "clear") => {
    for (const role of roles) {
      const next: CellState =
        mode === "view"
          ? { canView: true, canEdit: false }
          : mode === "edit"
            ? { canView: true, canEdit: true }
            : { canView: false, canEdit: false };
      apply(role.key, sectionKey, next);
    }
  };

  const setColumn = (roleKey: string, mode: "view" | "edit" | "clear") => {
    for (const s of sections) {
      const next: CellState =
        mode === "view"
          ? { canView: true, canEdit: false }
          : mode === "edit"
            ? { canView: true, canEdit: true }
            : { canView: false, canEdit: false };
      apply(roleKey, s, next);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl">Permissions</h1>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div>Failed to load matrix.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Access Control
          </div>
          <h1 className="font-serif text-3xl">Permissions matrix</h1>
          <p className="text-sm text-muted-foreground">
            Click <Eye className="inline h-3.5 w-3.5" /> to grant view, or{" "}
            <Pencil className="inline h-3.5 w-3.5" /> for edit. Use the row /
            column buttons for bulk changes.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-mono uppercase tracking-wider text-muted-foreground">
            Auto-saves
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b">
              <th className="sticky left-0 z-20 w-[280px] bg-card px-4 py-3 text-left font-medium">
                Section
              </th>
              {roles.map((r) => (
                <th
                  key={r.key}
                  className="min-w-[180px] border-l px-3 py-3 text-center"
                >
                  <div className="font-serif text-base">{r.label}</div>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <BulkBtn
                      label="View all"
                      icon={Eye}
                      onClick={() => setColumn(r.key, "view")}
                    />
                    <BulkBtn
                      label="Edit all"
                      icon={Pencil}
                      onClick={() => setColumn(r.key, "edit")}
                      tone="accent"
                    />
                    <BulkBtn
                      label="Clear"
                      icon={Ban}
                      onClick={() => setColumn(r.key, "clear")}
                      tone="muted"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([groupLabel, groupSections]) => (
              <RowGroup
                key={groupLabel}
                label={groupLabel}
                roles={roles}
                sections={groupSections}
                getCell={getCell}
                apply={apply}
                setRow={setRow}
                disabled={updateMutation.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkBtn({
  label,
  icon: Icon,
  onClick,
  tone = "primary",
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
  tone?: "primary" | "accent" | "muted";
}) {
  const toneCls =
    tone === "accent"
      ? "hover:bg-accent hover:text-accent-foreground"
      : tone === "muted"
        ? "hover:bg-muted"
        : "hover:bg-primary hover:text-primary-foreground";
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      title={label}
      className={`h-6 px-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground ${toneCls}`}
      onClick={onClick}
    >
      <Icon className="h-3 w-3" />
    </Button>
  );
}

function RowGroup({
  label,
  roles,
  sections,
  getCell,
  apply,
  setRow,
  disabled,
}: {
  label: string;
  roles: Array<{ key: string; label?: string | null }>;
  sections: string[];
  getCell: (r: string, s: string) => CellState;
  apply: (r: string, s: string, n: CellState) => void;
  setRow: (s: string, mode: "view" | "edit" | "clear") => void;
  disabled: boolean;
}) {
  return (
    <>
      <tr className="bg-muted/40">
        <td
          colSpan={1 + roles.length}
          className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {label}
        </td>
      </tr>
      {sections.map((section) => (
        <tr key={section} className="border-t hover:bg-muted/30">
          <td className="sticky left-0 z-10 bg-inherit px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {formatLabel(section.split(".").slice(1).join(".") || section)}
              </span>
              <div className="flex items-center gap-1">
                <BulkBtn
                  label="Grant view to all roles"
                  icon={Eye}
                  onClick={() => setRow(section, "view")}
                />
                <BulkBtn
                  label="Grant edit to all roles"
                  icon={Pencil}
                  onClick={() => setRow(section, "edit")}
                  tone="accent"
                />
                <BulkBtn
                  label="Revoke from all roles"
                  icon={Ban}
                  onClick={() => setRow(section, "clear")}
                  tone="muted"
                />
              </div>
            </div>
          </td>
          {roles.map((role) => {
            const cell = getCell(role.key, section);
            return (
              <td
                key={`${section}-${role.key}`}
                className="border-l px-3 py-2 text-center"
              >
                <div className="flex items-center justify-center gap-3">
                  <label
                    className="flex cursor-pointer items-center gap-1"
                    title="View"
                  >
                    <Checkbox
                      checked={cell.canView}
                      disabled={disabled}
                      onCheckedChange={() =>
                        apply(role.key, section, {
                          canView: !cell.canView,
                          canEdit: !cell.canView ? cell.canEdit : false,
                        })
                      }
                    />
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </label>
                  <label
                    className="flex cursor-pointer items-center gap-1"
                    title="Edit"
                  >
                    <Checkbox
                      checked={cell.canEdit}
                      disabled={disabled}
                      onCheckedChange={() =>
                        apply(role.key, section, {
                          canView: !cell.canEdit ? true : cell.canView,
                          canEdit: !cell.canEdit,
                        })
                      }
                    />
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </label>
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
