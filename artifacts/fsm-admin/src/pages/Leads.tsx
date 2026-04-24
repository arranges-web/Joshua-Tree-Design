import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListLeads,
  useUpdateLead,
  useConvertLeadToQuote,
  type Lead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Wand2, ArrowRight, X } from "lucide-react";
import {
  StatusBadge,
  SortHeader,
  Toolbar,
  Pager,
  useDataTable,
  applySortFilter,
} from "@/lib/data-table";

// "Open" = not yet handled — the default triage view.
const OPEN_STATUSES = new Set(["NEW", "CONTACTED"]);

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open (new + contacted)" },
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUOTED", label: "Quoted" },
  { value: "CONVERTED", label: "Converted" },
  { value: "DISMISSED", label: "Dismissed" },
] as const;

const SERVICE_OPTIONS = [
  { value: "ALL", label: "All services" },
  { value: "TREE_REMOVAL", label: "Tree removal" },
  { value: "TRIMMING_PRUNING", label: "Trimming / pruning" },
  { value: "MANGROVE_CARE", label: "Mangrove care" },
  { value: "STUMP_GRINDING", label: "Stump grinding" },
  { value: "EMERGENCY_STORM", label: "Emergency storm" },
  { value: "CRANE_ASSISTED", label: "Crane assisted" },
] as const;

const AGE_OPTIONS = [
  { value: "ALL", label: "Any age" },
  { value: "1", label: "Last 24 hours" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
] as const;

type SortKey = "createdAt" | "customerName" | "service" | "status" | "source";

function formatService(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ageInDays(d: Date | string): number {
  const created = typeof d === "string" ? new Date(d) : d;
  return (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
}

export function Leads() {
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("OPEN");
  const [serviceFilter, setServiceFilter] =
    useState<(typeof SERVICE_OPTIONS)[number]["value"]>("ALL");
  const [ageFilter, setAgeFilter] =
    useState<(typeof AGE_OPTIONS)[number]["value"]>("ALL");

  // Fetch a single status from the API when a single status is picked;
  // otherwise fetch everything and filter client-side. Keeps the API
  // surface simple while still scoping the network for narrow filters.
  const apiStatus =
    statusFilter !== "OPEN" && statusFilter !== "ALL"
      ? statusFilter
      : undefined;
  const { data, isLoading } = useListLeads(
    apiStatus ? { status: apiStatus } : undefined,
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const convertMutation = useConvertLeadToQuote();
  const updateMutation = useUpdateLead();

  const state = useDataTable<SortKey>("createdAt", "desc", 50);

  const allLeads: Lead[] = data?.leads ?? [];

  const { rows, total, totalPages } = applySortFilter<Lead, SortKey>(
    allLeads,
    state,
    (l) =>
      `${l.customerName ?? ""} ${l.propertyAddress ?? ""} ${l.notes ?? ""} ${l.service} ${l.source}`,
    (l, k) => {
      switch (k) {
        case "createdAt":
          return new Date(l.createdAt).getTime();
        case "customerName":
          return (l.customerName ?? "").toLowerCase();
        case "service":
          return l.service;
        case "status":
          return l.status;
        case "source":
          return l.source;
      }
    },
    (l) => {
      if (statusFilter === "OPEN" && !OPEN_STATUSES.has(l.status)) return false;
      if (serviceFilter !== "ALL" && l.service !== serviceFilter) return false;
      if (ageFilter !== "ALL") {
        const max = Number(ageFilter);
        if (ageInDays(l.createdAt) > max) return false;
      }
      return true;
    },
  );

  const visibleCount = useMemo(() => total, [total]);

  const convert = (lead: Lead) => {
    convertMutation.mutate(
      { id: lead.id },
      {
        onSuccess: (resp) => {
          queryClient.invalidateQueries();
          toast({
            title: "Draft quote created",
            description: `Quote #${resp.quote.id} ready to fill in.`,
          });
          setLocation(`/quotes`);
        },
        onError: () =>
          toast({
            title: "Couldn't convert lead",
            variant: "destructive",
          }),
      },
    );
  };

  const setStatus = (lead: Lead, status: string) => {
    updateMutation.mutate(
      { id: lead.id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: `Marked ${status.toLowerCase()}` });
        },
        onError: () =>
          toast({ title: "Couldn't update lead", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Operations
          </div>
          <h1 className="font-serif text-3xl">Leads inbox</h1>
          <p className="text-sm text-muted-foreground">
            New service requests from the website, portal, and phone.
          </p>
        </div>
      </div>

      <Toolbar
        state={state as never}
        total={visibleCount}
        searchPlaceholder="Search leads…"
      >
        <FilterField label="Status">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as (typeof STATUS_OPTIONS)[number]["value"])
            }
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Service">
          <Select
            value={serviceFilter}
            onValueChange={(v) =>
              setServiceFilter(v as (typeof SERVICE_OPTIONS)[number]["value"])
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Age">
          <Select
            value={ageFilter}
            onValueChange={(v) =>
              setAgeFilter(v as (typeof AGE_OPTIONS)[number]["value"])
            }
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_OPTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </Toolbar>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <div>No leads match the current filters.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader
                    label="Customer"
                    sortKey="customerName"
                    state={state}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader label="Service" sortKey="service" state={state} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Status" sortKey="status" state={state} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Source" sortKey="source" state={state} />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label="Received"
                    sortKey="createdAt"
                    state={state}
                  />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id} className="text-sm">
                  <TableCell>
                    <Link
                      href={`/customers/${l.customerId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {l.customerName ?? `Customer #${l.customerId}`}
                    </Link>
                    {l.propertyAddress && (
                      <div className="truncate text-xs text-muted-foreground">
                        📍 {l.propertyAddress}
                      </div>
                    )}
                    {l.notes && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {l.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {formatService(l.service)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {l.source}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(l.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {l.convertedQuoteId ? (
                        <Link href="/quotes">
                          <Button size="sm" variant="outline">
                            Quote #{l.convertedQuoteId}
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        l.status !== "DISMISSED" && (
                          <Button
                            size="sm"
                            onClick={() => convert(l)}
                            disabled={convertMutation.isPending}
                          >
                            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                            Convert
                          </Button>
                        )
                      )}
                      {l.status === "NEW" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(l, "CONTACTED")}
                          disabled={updateMutation.isPending}
                        >
                          Contacted
                        </Button>
                      )}
                      {l.status !== "DISMISSED" && l.status !== "CONVERTED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(l, "DISMISSED")}
                          disabled={updateMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
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

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
