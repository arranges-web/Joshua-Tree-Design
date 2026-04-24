import { Check, Circle } from "lucide-react";

// The happy-path lifecycle of a portal-submitted service request:
//   NEW (we received it) → CONTACTED → QUOTED → CONVERTED (scheduled).
// DISMISSED is a terminal "closed without scheduling" state which we
// surface as a dimmed final node. This shape mirrors the lead pipeline
// in artifacts/api-server/src/routes/portal.ts and the staff Leads
// inbox so the customer sees the same milestones the office does.
const STEPS: Array<{
  status: "NEW" | "CONTACTED" | "QUOTED" | "CONVERTED";
  label: string;
  blurb: string;
}> = [
  {
    status: "NEW",
    label: "We got it",
    blurb: "Your request is in our queue.",
  },
  {
    status: "CONTACTED",
    label: "We reached out",
    blurb: "Our team has been in touch.",
  },
  {
    status: "QUOTED",
    label: "Quote sent",
    blurb: "Pricing has been shared with you.",
  },
  {
    status: "CONVERTED",
    label: "Scheduled",
    blurb: "Booked as a job on the calendar.",
  },
];

const ORDER: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  QUOTED: 2,
  CONVERTED: 3,
  DISMISSED: -1,
};

export function StatusTimeline({
  status,
  variant = "default",
}: {
  status: string;
  variant?: "default" | "compact";
}) {
  const dismissed = status === "DISMISSED";
  const currentIdx = ORDER[status] ?? 0;

  if (dismissed) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        This request was closed without scheduling. Reach out to our office if
        you'd like us to revisit it.
      </div>
    );
  }

  return (
    <ol
      className={
        variant === "compact"
          ? "flex flex-wrap items-center gap-x-1 gap-y-2"
          : "grid gap-3 sm:grid-cols-4"
      }
      aria-label="Request status timeline"
    >
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const upcoming = i > currentIdx;
        return (
          <li
            key={s.status}
            className={
              variant === "compact"
                ? "flex items-center gap-1.5"
                : "flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
            }
          >
            <span
              className={`grid shrink-0 place-items-center rounded-full ${
                variant === "compact" ? "h-5 w-5" : "h-7 w-7"
              } ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
              aria-hidden
            >
              {done ? (
                <Check className={variant === "compact" ? "h-3 w-3" : "h-4 w-4"} />
              ) : (
                <Circle
                  className={variant === "compact" ? "h-2 w-2 fill-current" : "h-2.5 w-2.5 fill-current"}
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`text-xs font-medium leading-tight ${
                  upcoming ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {s.label}
              </div>
              {variant !== "compact" && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {active ? s.blurb : ""}
                </p>
              )}
            </div>
            {variant === "compact" && i < STEPS.length - 1 && (
              <span
                className={`mx-0.5 h-px w-4 ${
                  done ? "bg-primary/60" : "bg-border"
                }`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
