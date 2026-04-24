import { Link } from "wouter";
import {
  CalendarClock,
  CheckCircle2,
  Home as HomeIcon,
  Loader2,
  MapPin,
  Plus,
  Sprout,
} from "lucide-react";
import {
  usePortalListJobs,
  usePortalListProperties,
  usePortalListRequests,
  usePortalMe,
  type PortalJob,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

const SERVICE_LABELS: Record<string, string> = {
  TREE_REMOVAL: "Tree Removal",
  TRIMMING_PRUNING: "Trimming & Pruning",
  MANGROVE_CARE: "Mangrove Care",
  STUMP_GRINDING: "Stump Grinding",
  EMERGENCY_STORM: "Emergency Storm Response",
  CRANE_ASSISTED: "Crane-Assisted Removal",
};

function formatDate(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

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

function statusTone(status: string) {
  switch (status) {
    case "SCHEDULED":
      return "bg-primary/10 text-primary border-primary/25";
    case "IN_PROGRESS":
      return "bg-accent/15 text-accent border-accent/30";
    case "COMPLETE":
      return "bg-muted text-muted-foreground border-border";
    case "CANCELLED":
      return "bg-destructive/10 text-destructive border-destructive/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function leadStatusTone(status: string) {
  switch (status) {
    case "NEW":
      return "bg-accent/15 text-accent border-accent/30";
    case "CONTACTED":
      return "bg-primary/10 text-primary border-primary/25";
    case "QUOTED":
      return "bg-primary/15 text-primary border-primary/30";
    case "CONVERTED":
      return "bg-primary text-primary-foreground border-primary";
    case "DISMISSED":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function Home() {
  const meQ = usePortalMe();
  const propsQ = usePortalListProperties();
  const jobsQ = usePortalListJobs();
  const reqsQ = usePortalListRequests();

  // First name from full name — falls back to a generic greeting.
  const fullName = meQ.data?.customer.fullName ?? "";
  const customerName = fullName.split(" ")[0] || null;

  const isLoading = propsQ.isLoading || jobsQ.isLoading || reqsQ.isLoading;

  const upcoming = jobsQ.data?.upcoming ?? [];
  const past = jobsQ.data?.past ?? [];
  const properties = propsQ.data?.properties ?? [];
  const openRequests = useMemo(
    () =>
      (reqsQ.data?.requests ?? []).filter(
        (r) => r.status !== "CONVERTED" && r.status !== "DISMISSED",
      ),
    [reqsQ.data?.requests],
  );

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-border/70 bg-card p-8 shadow-sm sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Welcome
            </p>
            <h1 className="font-serif text-4xl leading-[1.1] sm:text-5xl">
              Hello, {customerName ?? "neighbor"}.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Here's a quick look at what's scheduled, what's in progress, and
              the properties we care for.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="gap-1.5">
              <Link href="/new-request">
                <Plus className="h-4 w-4" /> Request service
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/requests">My requests</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label="Upcoming visits"
            value={upcoming.length}
          />
          <Stat
            icon={<Sprout className="h-4 w-4" />}
            label="Open requests"
            value={openRequests.length}
          />
          <Stat
            icon={<HomeIcon className="h-4 w-4" />}
            label="Properties"
            value={properties.length}
          />
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your dashboard…
        </div>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Upcoming visits"
          subtitle="Scheduled and in-progress jobs."
          action={
            past.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {past.length} past visit{past.length === 1 ? "" : "s"}
              </span>
            ) : null
          }
        />
        {upcoming.length === 0 ? (
          <EmptyCard
            icon={<CalendarClock className="h-5 w-5" />}
            title="No visits scheduled"
            body="When we book your next service, it will show up here."
            cta={
              <Button asChild variant="outline" size="sm">
                <Link href="/new-request">Request service</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcoming.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <SectionHeader
            title="Open requests"
            subtitle="Service requests we haven't quoted yet."
            action={
              <Link
                href="/requests"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            }
          />
          {openRequests.length === 0 ? (
            <EmptyCard
              icon={<Sprout className="h-5 w-5" />}
              title="No open requests"
              body="Need work done? Send us a request and we'll be in touch."
              cta={
                <Button asChild size="sm">
                  <Link href="/new-request">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Request service
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {openRequests.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif text-lg leading-tight">
                        {SERVICE_LABELS[r.service] ?? r.service}
                      </div>
                      {r.propertyAddress && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {r.propertyAddress}
                        </div>
                      )}
                      {r.notes && (
                        <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
                          {r.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${leadStatusTone(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Submitted {formatDateOnly(r.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Your properties"
            subtitle="Locations we know about."
          />
          {properties.length === 0 ? (
            <EmptyCard
              icon={<HomeIcon className="h-5 w-5" />}
              title="No properties on file"
              body="Reach out to our office and we'll add them for you."
            />
          ) : (
            <div className="space-y-3">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <HomeIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">
                        {p.address}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.city}, FL {p.zip}
                      </div>
                      {p.notes && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {past.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Recent work"
            subtitle="Your most recent completed visits."
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {past.slice(0, 4).map((j) => (
              <JobCard key={j.id} job={j} variant="past" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-2xl leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {body}
      </p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

function JobCard({ job, variant = "upcoming" }: { job: PortalJob; variant?: "upcoming" | "past" }) {
  const dateLabel =
    variant === "past"
      ? formatDate(job.completedAt) ?? formatDate(job.createdAt)
      : formatDate(job.scheduledFor) ?? "To be scheduled";

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {variant === "past" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
            )}
            <span>{dateLabel}</span>
          </div>
          {job.propertyAddress && (
            <div className="mt-1 flex items-center gap-1 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {job.propertyAddress}
            </div>
          )}
          {job.crewName && (
            <div className="mt-1 text-xs text-muted-foreground">
              Crew: {job.crewName}
            </div>
          )}
          {job.notes && (
            <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
              {job.notes}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusTone(job.status)}`}
        >
          {job.status.replace("_", " ")}
        </span>
      </div>
      {variant === "upcoming" && job.totalCents > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>Estimated total</span>
          <span className="font-medium text-foreground">
            ${(job.totalCents / 100).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

