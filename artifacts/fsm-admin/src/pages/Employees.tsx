import { useState, useMemo } from "react";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
  useListRoles,
  useListDepartments,
  type Employee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Users, UserCheck, UserX, Search, Building2, Mail } from "lucide-react";

interface RoleRow {
  id: number;
  key: string;
  label?: string | null;
}
interface DeptRow {
  id: number;
  key: string;
  label?: string | null;
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  tone?: "emerald" | "rose" | "neutral";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// Two-letter initials for the avatar circle. Drops single-word names
// to a single letter rather than weirdly stretching them.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

// Hash the name to a stable hue so each member has a consistent
// avatar color across the app — matches the kind of polish you'd see
// in Linear / Notion.
function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return ((hash % 360) + 360) % 360;
}

const ROLE_BADGE_TONE: Record<string, string> = {
  ADMIN: "border-violet-300 bg-violet-50 text-violet-700",
  SALES: "border-blue-300 bg-blue-50 text-blue-700",
  CREW_LEAD: "border-emerald-300 bg-emerald-50 text-emerald-700",
  MECHANIC: "border-amber-300 bg-amber-50 text-amber-700",
  ACCOUNTING_MANAGER: "border-rose-300 bg-rose-50 text-rose-700",
};

export function Employees() {
  const { data, isLoading } = useListEmployees();
  const { data: rolesData } = useListRoles();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const employees = data?.employees ?? [];
  const roles = (rolesData?.roles ?? []) as RoleRow[];

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter === "ACTIVE" && !emp.isActive) return false;
      if (statusFilter === "INACTIVE" && emp.isActive) return false;
      if (roleFilter !== "ALL" && emp.role !== roleFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !emp.fullName.toLowerCase().includes(q) &&
          !emp.email.toLowerCase().includes(q) &&
          !emp.department.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [employees, query, roleFilter, statusFilter]);

  const totalActive = employees.filter((e) => e.isActive).length;
  const totalInactive = employees.filter((e) => !e.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Crew members and their maintenance activity</p>
        </div>
        <EmployeeFormDialog
          isOpen={isCreateOpen}
          setIsOpen={setIsCreateOpen}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 grid-cols-3">
        <StatCard title="Total Crew" value={employees.length} icon={Users} />
        <StatCard
          title="Active"
          value={totalActive}
          icon={UserCheck}
          tone="emerald"
        />
        <StatCard
          title="Inactive"
          value={totalInactive}
          icon={UserX}
          tone={totalInactive > 0 ? "rose" : "neutral"}
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name, email, dept…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.key}>
                  {r.label ?? r.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active only</SelectItem>
              <SelectItem value="INACTIVE">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            Showing <span className="font-mono">{filtered.length}</span> of{" "}
            <span className="font-mono">{employees.length}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[32%]">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Logs Filed</TableHead>
                <TableHead>Last Entry</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => {
                const initials = getInitials(emp.fullName);
                const hue = nameHue(emp.fullName);
                const roleClass =
                  ROLE_BADGE_TONE[emp.role] ?? "border-border bg-muted text-foreground";
                return (
                  <TableRow key={emp.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
                          style={{
                            backgroundColor: `hsl(${hue} 55% 48%)`,
                          }}
                          aria-hidden="true"
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {emp.fullName}
                          </div>
                          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono uppercase tracking-wider ${roleClass}`}
                      >
                        {emp.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {emp.department}
                      </span>
                    </TableCell>
                    <TableCell>
                      {emp.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {(emp.logCount ?? 0) > 0 ? (
                        emp.logCount
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.lastLoggedAt ? (
                        new Date(emp.lastLoggedAt).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <EmployeeFormDialog
                          employee={emp}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DeleteEmployee id={emp.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-md bg-card">
          {employees.length === 0 ? "No team members found." : "No results match your filters."}
        </div>
      )}
    </div>
  );
}

function EmployeeFormDialog({ employee, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { employee?: Employee, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const { data: rolesData } = useListRoles();
  const { data: departmentsData } = useListDepartments();

  const [formData, setFormData] = useState({
    fullName: employee?.fullName || "",
    email: employee?.email || "",
    password: "",
    roleId: employee?.roleId?.toString() || "",
    departmentId: employee?.departmentId?.toString() || "",
    isActive: employee !== undefined ? employee.isActive : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (employee) {
      const payload: {
        fullName: string;
        email: string;
        isActive: boolean;
        password?: string;
        roleId?: number;
        departmentId?: number;
      } = {
        fullName: formData.fullName,
        email: formData.email,
        isActive: formData.isActive,
      };

      if (formData.password) {
        payload.password = formData.password;
      }
      if (formData.roleId) {
        payload.roleId = parseInt(formData.roleId, 10);
      }
      if (formData.departmentId) {
        payload.departmentId = parseInt(formData.departmentId, 10);
      }

      updateMutation.mutate(
        { id: employee.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            toast({ title: "Team member updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating team member", variant: "destructive" })
        }
      );
    } else {
      const roleId = parseInt(formData.roleId, 10);
      const departmentId = parseInt(formData.departmentId, 10);
      if (!Number.isFinite(roleId) || !Number.isFinite(departmentId)) {
        toast({
          title: "Pick a role and a department before saving",
          variant: "destructive",
        });
        return;
      }
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        roleId,
        departmentId,
        isActive: formData.isActive,
      };

      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            toast({ title: "Team member added" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error adding team member", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password {employee && "(leave blank to keep current)"}</Label>
            <Input id="password" type="password" required={!employee} minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.roleId} onValueChange={(val) => setFormData({ ...formData, roleId: val })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {((rolesData?.roles ?? []) as RoleRow[]).map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      {r.label ?? r.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.departmentId} onValueChange={(val) => setFormData({ ...formData, departmentId: val })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {((departmentsData?.departments ?? []) as DeptRow[]).map(
                    (d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.label ?? d.key}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(val) => setFormData({ ...formData, isActive: val })}
            />
            <Label htmlFor="isActive">Active account</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployee({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteEmployee();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          toast({ title: "Team member removed" });
        },
        onError: () => toast({ title: "Error removing team member", variant: "destructive" })
      }
    );
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this team member?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate their account. Their maintenance log history will be preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
