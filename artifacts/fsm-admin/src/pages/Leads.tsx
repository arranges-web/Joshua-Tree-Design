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
import { useToast } from "@/hooks/use-toast";
import { Inbox, Wand2, ArrowRight, X } from "lucide-react";
import { StatusBadge } from "@/lib/data-table";

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

  const allLeads: Lead[] = data?.leads ?? [];

  const visibleLeads = useMemo(() => {
    return allLeads.filter((l) => {
      if (statusFilter === "OPEN" && !OPEN_STATUSES.has(l.status)) return false;
      if (serviceFilter !== "ALL" && l.service !== serviceFilter) return false;
      if (ageFilter !== "ALL") {
        const max = Number(ageFilter);
        if (ageInDays(l.createdAt) > max) return false;
      }
      return true;
    });
  }, [allLeads, statusFilter, serviceFilter, ageFilter]);

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
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Status">
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(
                  v as (typeof STATUS_OPTIONS)[number]["value"],
                )
              }
            >
              <SelectTrigger className="w-[200px]">
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
                setServiceFilter(
                  v as (typeof SERVICE_OPTIONS)[number]["value"],
                )
              }
            >
              <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[160px]">
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
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : visibleLeads.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <div>No leads match the current filters.</div>
          </div>
        ) : (
          <ul className="divide-y">
            {visibleLeads.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-3 p-4 hover:bg-muted/30 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/customers/${l.customerId}`}
                      className="font-serif text-base font-medium underline-offset-4 hover:underline"
                    >
                      {l.customerName ?? `Customer #${l.customerId}`}
                    </Link>
                    <StatusBadge status={l.status} />
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {formatService(l.service)}
                    </Badge>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {l.source}
                    </span>
                  </div>
                  {l.propertyAddress && (
                    <div className="text-xs text-muted-foreground">
                      📍 {l.propertyAddress}
                    </div>
                  )}
                  {l.notes && (
                    <p className="text-sm text-muted-foreground">{l.notes}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>Received {formatDate(l.createdAt)}</span>
                    {(l.preferredWindowStart || l.preferredWindowEnd) && (
                      <span>
                        · Wants {formatDate(l.preferredWindowStart)} –{" "}
                        {formatDate(l.preferredWindowEnd)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                        Convert to quote
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
                      Mark contacted
                    </Button>
                  )}
                  {l.status !== "DISMISSED" && l.status !== "CONVERTED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatus(l, "DISMISSED")}
                      disabled={updateMutation.isPending}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
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
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
