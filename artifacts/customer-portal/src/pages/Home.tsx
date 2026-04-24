import { Link } from "wouter";
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  Home as HomeIcon,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Sprout,
  Users,
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
import { StatusTimeline } from "@/components/StatusTimeline";

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

function formatLongDate(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function formatTimeOnly(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleTimeString(undefined, {
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

  // The very next visit (soonest scheduledFor) is the hero. The rest of
  // the upcoming list trails below.
  const nextVisit = upcoming[0] ?? null;
  const otherUpcoming = upcoming.slice(1);

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

      {/* Next visit hero — always rendered so the customer's eye lands on
          it first; collapses to an empty-state when nothing is booked. */}
      <NextVisitHero job={nextVisit} />

      {otherUpcoming.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Other upcoming visits"
            subtitle="More work scheduled at your properties."
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {otherUpcoming.map((j) => (
              <UpcomingJobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      {/* Properties strip — horizontal, snap-scrolling on mobile, single
          row on wide screens. The task explicitly asks for a strip
          rather than a stacked card list. */}
      <PropertiesStrip properties={properties} />

      <section className="space-y-4">
        <SectionHeader
          title="Open requests"
          subtitle="Service requests we haven't quoted yet."
          action={
            openRequests.length > 0 ? (
              <Link
                href="/requests"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            ) : null
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {formatDateOnly(r.createdAt)}
                  </span>
                </div>
                <div className="mt-3">
                  <StatusTimeline status={r.status} variant="compact" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Past work"
            subtitle="Every visit, most recent first."
          />
          <PastJobsTimeline jobs={past.slice(0, 6)} />
          {past.length > 6 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing your 6 most recent visits.
            </p>
          )}
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

function NextVisitHero({ job }: { job: PortalJob | null }) {
  if (!job) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-2xl">No visits booked just yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          When we book your next service, the date, address, and crew will
          appear right here.
        </p>
        <Button asChild className="mt-5 gap-1.5">
          <Link href="/new-request">
            <Plus className="h-4 w-4" /> Request service
          </Link>
        </Button>
      </section>
    );
  }

  const day = formatLongDate(job.scheduledFor);
  const time = formatTimeOnly(job.scheduledFor);

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/5 via-card to-card p-8 shadow-sm sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            Your next visit
          </div>
          <div>
            <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
              {day ?? "Date to be confirmed"}
            </h2>
            {time && (
              <p className="mt-1 text-sm text-muted-foreground">
                Arriving around {time}
              </p>
            )}
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {job.propertyAddress && (
              <HeroRow
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Where"
                value={job.propertyAddress}
              />
            )}
            {job.crewName && (
              <HeroRow
                icon={<Users className="h-3.5 w-3.5" />}
                label="Crew"
                value={job.crewName}
              />
            )}
            <HeroRow
              icon={<Sprout className="h-3.5 w-3.5" />}
              label="What we'll do"
              value={
                job.notes && job.notes.trim().length > 0
                  ? job.notes.trim()
                  : "Tree care visit"
              }
            />
            {job.totalCents > 0 && (
              <HeroRow
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Estimated total"
                value={`$${(job.totalCents / 100).toFixed(2)}`}
              />
            )}
          </dl>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusTone(job.status)}`}
        >
          {job.status.replace("_", " ")}
        </span>
      </div>
    </section>
  );
}

function HeroRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium leading-snug">{value}</dd>
    </div>
  );
}

function UpcomingJobCard({ job }: { job: PortalJob }) {
  const dateLabel = formatDate(job.scheduledFor) ?? "To be scheduled";
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
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
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusTone(job.status)}`}
        >
          {job.status.replace("_", " ")}
        </span>
      </div>
      {job.totalCents > 0 && (
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

function PropertiesStrip({
  properties,
}: {
  properties: Array<{
    id: number;
    address: string;
    city: string;
    zip: string;
    notes?: string | null;
  }>;
}) {
  if (properties.length === 0) {
    return (
      <section className="space-y-4">
        <SectionHeader title="Your properties" subtitle="Locations we know about." />
        <EmptyCard
          icon={<HomeIcon className="h-5 w-5" />}
          title="No properties on file"
          body="Reach out to our office and we'll add them for you."
        />
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Your properties"
        subtitle={
          properties.length === 1
            ? "Where we care for trees."
            : `${properties.length} addresses we look after.`
        }
      />
      <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {properties.map((p) => (
          <article
            key={p.id}
            className="flex min-w-[260px] max-w-[320px] flex-1 snap-start flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <HomeIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium leading-tight">
                  {p.address}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.city}, FL {p.zip}
                </div>
              </div>
            </div>
            {p.notes && (
              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                {p.notes}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function PastJobsTimeline({ jobs }: { jobs: PortalJob[] }) {
  return (
    <ol className="relative space-y-5 border-l border-border/70 pl-6">
      {jobs.map((j) => {
        const date =
          formatDateOnly(j.completedAt) ?? formatDateOnly(j.createdAt);
        const service =
          j.notes && j.notes.trim().length > 0
            ? j.notes.trim()
            : "Tree care visit";
        return (
          <li key={j.id} className="relative">
            <span
              className="absolute -left-[33px] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm"
              aria-hidden
            >
              <CheckCircle2 className="h-3 w-3" />
            </span>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {date}
                  </div>
                  <div className="mt-0.5 font-serif text-lg leading-tight">
                    {service}
                  </div>
                  {j.propertyAddress && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {j.propertyAddress}
                    </div>
                  )}
                  {j.crewName && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> Crew lead: {j.crewName}
                    </div>
                  )}
                </div>
                {j.totalCents > 0 ? (
                  <div className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Final price
                    </div>
                    <div className="font-medium">
                      ${(j.totalCents / 100).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusTone(j.status)}`}
                  >
                    {j.status.replace("_", " ")}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                Photo gallery coming soon
                <ChevronRight className="ml-auto h-3 w-3" />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
