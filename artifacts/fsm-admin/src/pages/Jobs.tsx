import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import {
  useListJobs,
  useCreateJob,
  useUpdateJob,
  useDeleteJob,
  getListJobsQueryKey,
  type Job,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Plus } from "lucide-react";
import {
  applySortFilter,
  Pager,
  SortHeader,
  StatusBadge,
  Toolbar,
  useDataTable,
} from "@/lib/data-table";

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents ?? 0) / 100);

type SortKey = "id" | "status" | "scheduledFor" | "completedAt" | "totalCents";

const STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETE", "CANCELLED"] as const;

export function Jobs() {
  const { data, isLoading } = useListJobs();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [initialPropertyId, setInitialPropertyId] = useState<number | null>(
    null,
  );
  const state = useDataTable<SortKey>("scheduledFor", "desc", 50);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Open the new-job dialog with a property pre-filled when arriving from
  // a customer profile via /jobs?newJobForProperty=<id>.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const raw = params.get("newJobForProperty");
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) {
      setInitialPropertyId(n);
      setIsCreateOpen(true);
      params.delete("newJobForProperty");
      const qs = params.toString();
      setLocation(`/jobs${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [search, setLocation]);

  const allRows: Job[] = data?.jobs ?? [];

  const { rows, total, totalPages } = applySortFilter<Job, SortKey>(
    allRows,
    state,
    (r) =>
      `#${r.id} ${r.status} ${r.notes ?? ""} property:${r.propertyId ?? ""} crew:${r.crewId ?? ""}`,
    (r, k) => {
      const v = r[k];
      if ((k === "scheduledFor" || k === "completedAt") && typeof v === "string")
        return new Date(v).getTime();
      return (v as string | number | null | undefined) ?? null;
    },
    statusFilter === "ALL" ? undefined : (r) => r.status === statusFilter,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Operations
          </div>
          <h1 className="font-serif text-3xl">Jobs</h1>
        </div>
        <JobFormDialog
          isOpen={isCreateOpen}
          setIsOpen={(v) => {
            setIsCreateOpen(v);
            if (!v) setInitialPropertyId(null);
          }}
          initialPropertyId={initialPropertyId}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </Button>
          }
        />
      </div>

      <Toolbar
        state={state as never}
        total={total}
        searchPlaceholder="Search by id, status, notes, property, crew…"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              statusFilter === "ALL"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.replace("_", " ").toLowerCase()}
            </button>
          ))}
        </div>
      </Toolbar>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No jobs match the current filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">
                  <SortHeader
                    label="ID"
                    sortKey="id"
                    state={state}
                  />
                </TableHead>
                <TableHead className="w-[140px]">
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    state={state}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label="Scheduled"
                    sortKey="scheduledFor"
                    state={state}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label="Completed"
                    sortKey="completedAt"
                    state={state}
                  />
                </TableHead>
                <TableHead className="w-[120px]">
                  <SortHeader
                    label="Total"
                    sortKey="totalCents"
                    state={state}
                    align="right"
                  />
                </TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((job) => (
                <TableRow key={job.id} className="text-sm">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{job.id}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.scheduledFor
                      ? new Date(job.scheduledFor).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.completedAt
                      ? new Date(job.completedAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {usd(job.totalCents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <JobFormDialog
                        job={job}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DeleteJob id={job.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager state={state} totalPages={totalPages} total={total} />
      </div>
    </div>
  );
}

function JobFormDialog({
  job,
  trigger,
  isOpen: controlledIsOpen,
  setIsOpen: controlledSetIsOpen,
  initialPropertyId,
}: {
  job?: {
    id: number;
    propertyId?: number;
    crewId?: number | null;
    status: string;
    scheduledFor?: string | null;
    completedAt?: string | null;
    totalCents: number;
    notes?: string | null;
  };
  trigger?: React.ReactNode;
  isOpen?: boolean;
  setIsOpen?: (v: boolean) => void;
  initialPropertyId?: number | null;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen =
    controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob();

  const [formData, setFormData] = useState({
    propertyId:
      job?.propertyId?.toString() ||
      (initialPropertyId != null ? String(initialPropertyId) : ""),
    crewId: job?.crewId?.toString() || "",
    status: job?.status || "SCHEDULED",
    scheduledFor: job?.scheduledFor
      ? new Date(job.scheduledFor).toISOString().slice(0, 16)
      : "",
    completedAt: job?.completedAt
      ? new Date(job.completedAt).toISOString().slice(0, 16)
      : "",
    totalDollars: job ? (job.totalCents / 100).toString() : "0",
    notes: job?.notes || "",
  });

  // If the dialog was opened with a pre-selected property (e.g. clicking
  // "Add job at this property" from a customer profile), seed the field.
  useEffect(() => {
    if (!job && isOpen && initialPropertyId != null) {
      setFormData((prev) =>
        prev.propertyId === String(initialPropertyId)
          ? prev
          : { ...prev, propertyId: String(initialPropertyId) },
      );
    }
  }, [isOpen, initialPropertyId, job]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const propertyId = parseInt(formData.propertyId, 10);
    if (!Number.isFinite(propertyId)) {
      toast({ title: "Pick a property before saving", variant: "destructive" });
      return;
    }
    const payload = {
      propertyId,
      crewId: formData.crewId ? parseInt(formData.crewId, 10) : null,
      status: formData.status,
      scheduledFor: formData.scheduledFor
        ? new Date(formData.scheduledFor).toISOString()
        : null,
      completedAt: formData.completedAt
        ? new Date(formData.completedAt).toISOString()
        : null,
      totalCents: Math.round(parseFloat(formData.totalDollars || "0") * 100),
      notes: formData.notes,
    };
    const after = (msg: string) => {
      queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
      toast({ title: msg });
      setIsOpen(false);
    };
    if (job) {
      updateMutation.mutate(
        { id: job.id, data: payload },
        {
          onSuccess: () => after("Job updated"),
          onError: () =>
            toast({ title: "Error updating job", variant: "destructive" }),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => after("Job created"),
          onError: () =>
            toast({ title: "Error creating job", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {job ? `Edit job #${job.id}` : "New job"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="propertyId">Property ID</Label>
              <Input
                id="propertyId"
                type="number"
                required
                value={formData.propertyId}
                onChange={(e) =>
                  setFormData({ ...formData, propertyId: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crewId">Crew ID</Label>
              <Input
                id="crewId"
                type="number"
                value={formData.crewId}
                onChange={(e) =>
                  setFormData({ ...formData, crewId: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ").toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledFor">Scheduled For</Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledFor: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="completedAt">Completed At</Label>
              <Input
                id="completedAt"
                type="datetime-local"
                value={formData.completedAt}
                onChange={(e) =>
                  setFormData({ ...formData, completedAt: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalDollars">Total ($)</Label>
            <Input
              id="totalDollars"
              type="number"
              step="0.01"
              required
              value={formData.totalDollars}
              onChange={(e) =>
                setFormData({ ...formData, totalDollars: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteJob({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteJob();
  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          toast({ title: "Job deleted" });
        },
        onError: () =>
          toast({ title: "Error deleting job", variant: "destructive" }),
      },
    );
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete job #{id}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the job. This action can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
