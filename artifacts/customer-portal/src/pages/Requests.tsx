import { Link } from "wouter";
import { ArrowLeft, CalendarClock, MapPin, Plus, Sprout } from "lucide-react";
import { usePortalListRequests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { StatusTimeline } from "@/components/StatusTimeline";

const SERVICE_LABELS: Record<string, string> = {
  TREE_REMOVAL: "Tree Removal",
  TRIMMING_PRUNING: "Trimming & Pruning",
  MANGROVE_CARE: "Mangrove Care",
  STUMP_GRINDING: "Stump Grinding",
  EMERGENCY_STORM: "Emergency Storm Response",
  CRANE_ASSISTED: "Crane-Assisted Removal",
};

function formatDateOnly(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatRange(start?: string | null, end?: string | null) {
  if (!start && !end) return null;
  const s = start ? formatDateOnly(start) : null;
  const e = end ? formatDateOnly(end) : null;
  if (s && e) return `${s} – ${e}`;
  return s ?? e ?? null;
}

export function Requests() {
  const reqsQ = usePortalListRequests();
  const requests = reqsQ.data?.requests ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to overview
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl">My requests</h1>
            <p className="text-sm text-muted-foreground">
              Everything you've asked us to look at, oldest at the bottom.
            </p>
          </div>
          <Button asChild className="gap-1.5">
            <Link href="/new-request">
              <Plus className="h-4 w-4" /> New request
            </Link>
          </Button>
        </div>
      </div>

      {reqsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-2xl">No requests yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            When you ask us to look at a tree, you'll see the request and its
            status here.
          </p>
          <Button asChild className="mt-5 gap-1.5">
            <Link href="/new-request">
              <Plus className="h-4 w-4" /> Submit a request
            </Link>
          </Button>
        </div>
      ) : (
        <ol className="space-y-4">
          {requests.map((r) => {
            const range = formatRange(r.preferredWindowStart, r.preferredWindowEnd);
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-2xl leading-tight">
                      {SERVICE_LABELS[r.service] ?? r.service}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {r.propertyAddress && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {r.propertyAddress}
                        </span>
                      )}
                      <span>Submitted {formatDateOnly(r.createdAt)}</span>
                      {range && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Preferred {range}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {r.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/40 p-3 text-sm text-foreground/85">
                    {r.notes}
                  </p>
                )}

                <div className="mt-4">
                  <StatusTimeline status={r.status} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
