import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  getPortalListRequestsQueryKey,
  usePortalCreateRequest,
  usePortalListProperties,
  LeadService,
  type LeadService as LeadServiceT,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const SERVICES: Array<{
  value: LeadServiceT;
  label: string;
  blurb: string;
  emoji: string;
}> = [
  {
    value: LeadService.TRIMMING_PRUNING,
    label: "Trimming & Pruning",
    blurb: "Shape, thin, and clear deadwood for healthy growth.",
    emoji: "🌳",
  },
  {
    value: LeadService.TREE_REMOVAL,
    label: "Tree Removal",
    blurb: "Safe, complete removal of unwanted or hazardous trees.",
    emoji: "🪓",
  },
  {
    value: LeadService.STUMP_GRINDING,
    label: "Stump Grinding",
    blurb: "Grind stumps below grade so you can replant or pave.",
    emoji: "🪵",
  },
  {
    value: LeadService.MANGROVE_CARE,
    label: "Mangrove Care",
    blurb: "Permitted trimming and care for waterfront mangroves.",
    emoji: "🌿",
  },
  {
    value: LeadService.EMERGENCY_STORM,
    label: "Emergency / Storm",
    blurb: "Storm damage and urgent hazards — fastest response.",
    emoji: "⚡",
  },
  {
    value: LeadService.CRANE_ASSISTED,
    label: "Crane-Assisted",
    blurb: "Heavy lifts in tight spots, done with crane support.",
    emoji: "🏗️",
  },
];

export function NewRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const propsQ = usePortalListProperties();

  const [service, setService] = useState<LeadServiceT | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const createReq = usePortalCreateRequest({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getPortalListRequestsQueryKey(),
        });
        setSubmitted(true);
      },
      onError: (err) => {
        const code = (err as { data?: { error?: string } }).data?.error;
        if (code === "property_not_owned") {
          setErrorMsg(
            "That property isn't on your account. Pick another or leave blank.",
          );
        } else if (code === "invalid_body") {
          setErrorMsg("Please double-check the form and try again.");
        } else {
          setErrorMsg(
            (err as Error).message ?? "Couldn't submit your request.",
          );
        }
      },
    },
  });

  const properties = propsQ.data?.properties ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!service) {
      setErrorMsg("Pick a service so we know how to help.");
      return;
    }

    const startIso = windowStart ? new Date(windowStart).toISOString() : null;
    const endIso = windowEnd ? new Date(windowEnd).toISOString() : null;
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setErrorMsg("End of preferred window must be after the start.");
      return;
    }

    createReq.mutate({
      data: {
        service,
        propertyId,
        notes: notes.trim() || null,
        preferredWindowStart: startIso,
        preferredWindowEnd: endIso,
      },
    });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border/70 bg-card p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-3xl">Request received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks — our team will review and reach out shortly. You can track
          status in My Requests.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/requests">View my requests</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to overview</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to overview
        </Link>
        <h1 className="font-serif text-4xl">Request service</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Tell us what you need. We'll review and follow up to schedule and
          quote — no pressure.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-3">
          <Label number="1" title="What kind of work?" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => {
              const active = service === s.value;
              return (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setService(s.value)}
                  className={`rounded-2xl border p-4 text-left transition-all hover:border-primary/60 hover:shadow-sm ${
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border/70 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{s.emoji}</span>
                    {active && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="mt-3 font-serif text-lg leading-tight">
                    {s.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <Label
            number="2"
            title="Which property?"
            optional={properties.length > 1}
          />
          {properties.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-card/40 px-3 py-3 text-sm text-muted-foreground">
              We don't have a property on file yet — leave blank and we'll
              confirm the address with you.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {properties.map((p) => {
                const active = propertyId === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setPropertyId(active ? null : p.id)
                    }
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border/70 bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="font-medium leading-tight">{p.address}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.city}, FL {p.zip}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <Label number="3" title="Tell us more" optional />
          <Textarea
            placeholder="Anything we should know? (gate codes, urgency, specific trees…)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="resize-none text-base"
          />
        </section>

        <section className="space-y-3">
          <Label number="4" title="Preferred window" optional />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Earliest</span>
              <Input
                type="datetime-local"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="h-11"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Latest</span>
              <Input
                type="datetime-local"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="h-11"
              />
            </label>
          </div>
        </section>

        {errorMsg && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
          <Button
            type="submit"
            size="lg"
            className="gap-1.5"
            disabled={createReq.isPending || !service}
          >
            {createReq.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Submit request
              </>
            )}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Label({
  number,
  title,
  optional,
}: {
  number: string;
  title: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
        {number}
      </span>
      <h2 className="font-serif text-xl leading-tight">{title}</h2>
      {optional && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Optional
        </span>
      )}
    </div>
  );
}
