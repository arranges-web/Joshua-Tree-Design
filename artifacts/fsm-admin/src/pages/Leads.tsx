import { useState } from "react";
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

const STATUS_OPTIONS = [
  "ALL",
  "NEW",
  "CONTACTED",
  "QUOTED",
  "CONVERTED",
  "DISMISSED",
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

export function Leads() {
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("NEW");
  const queryParams =
    statusFilter === "ALL" ? undefined : { status: statusFilter };
  const { data, isLoading } = useListLeads(queryParams);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const convertMutation = useConvertLeadToQuote();
  const updateMutation = useUpdateLead();

  const leads: Lead[] = data?.leads ?? [];
  const newCount = leads.filter((l) => l.status === "NEW").length;

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
            {statusFilter !== "NEW" && newCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700">
                <Inbox className="h-3.5 w-3.5" />
                {newCount} unhandled
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as (typeof STATUS_OPTIONS)[number])
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <div>
              {statusFilter === "ALL"
                ? "No leads have come in yet."
                : `No ${statusFilter.toLowerCase()} leads right now.`}
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {leads.map((l) => (
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
