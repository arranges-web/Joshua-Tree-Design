import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
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
import { StatusTimeline } from "@/components/StatusTimeline";

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

type StepId = "service" | "property" | "photos" | "details" | "review";
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "service", label: "Service" },
  { id: "property", label: "Property" },
  { id: "photos", label: "Photos" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
];

export function NewRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const propsQ = usePortalListProperties();

  const [stepIndex, setStepIndex] = useState(0);
  const [service, setService] = useState<LeadServiceT | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const step = STEPS[stepIndex]!;

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
  const selectedService = SERVICES.find((s) => s.value === service) ?? null;
  const selectedProperty = properties.find((p) => p.id === propertyId) ?? null;

  function canAdvance(): boolean {
    if (step.id === "service") return service != null;
    if (step.id === "property") return true;
    if (step.id === "photos") return true;
    if (step.id === "details") {
      if (!windowStart && !windowEnd) return true;
      if (windowStart && windowEnd) {
        return new Date(windowEnd) > new Date(windowStart);
      }
      return true;
    }
    return true;
  }

  function next() {
    setErrorMsg(null);
    if (step.id === "details" && windowStart && windowEnd) {
      if (new Date(windowEnd) <= new Date(windowStart)) {
        setErrorMsg("End of preferred window must be after the start.");
        return;
      }
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setErrorMsg(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).map((f) => f.name);
    setPhotoNames((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  }
  function removePhoto(name: string) {
    setPhotoNames((prev) => prev.filter((n) => n !== name));
  }

  function handleSubmit() {
    setErrorMsg(null);
    if (!service) {
      setErrorMsg("Pick a service so we know how to help.");
      setStepIndex(0);
      return;
    }
    const startIso = windowStart ? new Date(windowStart).toISOString() : null;
    const endIso = windowEnd ? new Date(windowEnd).toISOString() : null;

    // Photo uploads are deferred — surfaced in the customer's notes so the
    // office knows photos were attached, until the object-storage upload
    // path is wired up in a follow-up task.
    const photoLine =
      photoNames.length > 0
        ? `\n\n[Customer attached ${photoNames.length} photo${
            photoNames.length === 1 ? "" : "s"
          }: ${photoNames.join(", ")}]`
        : "";

    createReq.mutate({
      data: {
        service,
        propertyId,
        notes: (notes.trim() + photoLine).trim() || null,
        preferredWindowStart: startIso,
        preferredWindowEnd: endIso,
      },
    });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border/70 bg-card p-10 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-3xl">We got it</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks for the details — our team is reviewing your request and
            will reach out shortly. Here's how it'll move:
          </p>
        </div>
        <div className="mt-7">
          <StatusTimeline status="NEW" />
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
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
          A few quick steps. We'll review and follow up to schedule and quote
          — no pressure.
        </p>
      </div>

      <Stepper stepIndex={stepIndex} />

      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        {step.id === "service" && (
          <StepService
            service={service}
            onPick={(v) => setService(v)}
          />
        )}
        {step.id === "property" && (
          <StepProperty
            properties={properties}
            propertyId={propertyId}
            onPick={(id) => setPropertyId(id)}
          />
        )}
        {step.id === "photos" && (
          <StepPhotos
            photoNames={photoNames}
            onPick={handlePhotoPick}
            onRemove={removePhoto}
          />
        )}
        {step.id === "details" && (
          <StepDetails
            notes={notes}
            setNotes={setNotes}
            windowStart={windowStart}
            setWindowStart={setWindowStart}
            windowEnd={windowEnd}
            setWindowEnd={setWindowEnd}
          />
        )}
        {step.id === "review" && (
          <StepReview
            service={selectedService}
            property={selectedProperty}
            photoCount={photoNames.length}
            notes={notes}
            windowStart={windowStart}
            windowEnd={windowEnd}
          />
        )}

        {errorMsg && (
          <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <div>
          {stepIndex > 0 ? (
            <Button variant="outline" size="lg" onClick={back}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setLocation("/")}
            >
              Cancel
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          {step.id === "review" ? (
            <Button
              size="lg"
              className="gap-1.5"
              disabled={createReq.isPending || !service}
              onClick={handleSubmit}
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
          ) : (
            <Button
              size="lg"
              className="gap-1.5"
              onClick={next}
              disabled={!canAdvance()}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ stepIndex }: { stepIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {STEPS.map((s, i) => {
        const done = i < stepIndex;
        const active = i === stepIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-medium ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={`font-medium ${
                active
                  ? "text-foreground"
                  : done
                    ? "text-muted-foreground"
                    : "text-muted-foreground/70"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 space-y-1">
      <h2 className="font-serif text-2xl leading-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function StepService({
  service,
  onPick,
}: {
  service: LeadServiceT | null;
  onPick: (v: LeadServiceT) => void;
}) {
  return (
    <div>
      <StepHeader
        title="What kind of work?"
        subtitle="Pick the service that fits best — you can add notes later."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const active = service === s.value;
          return (
            <button
              type="button"
              key={s.value}
              onClick={() => onPick(s.value)}
              className={`rounded-2xl border p-4 text-left transition-all hover:border-primary/60 hover:shadow-sm ${
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border/70 bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{s.emoji}</span>
                {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <div className="mt-3 font-serif text-lg leading-tight">
                {s.label}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepProperty({
  properties,
  propertyId,
  onPick,
}: {
  properties: Array<{ id: number; address: string; city: string; zip: string }>;
  propertyId: number | null;
  onPick: (id: number | null) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Which property?"
        subtitle="Optional — if it's a new address, leave blank and we'll confirm with you."
      />
      {properties.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/40 px-3 py-3 text-sm text-muted-foreground">
          We don't have a property on file yet — leave blank and we'll confirm
          the address with you.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {properties.map((p) => {
            const active = propertyId === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onPick(active ? null : p.id)}
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
    </div>
  );
}

function StepPhotos({
  photoNames,
  onPick,
  onRemove,
}: {
  photoNames: string[];
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (name: string) => void;
}) {
  const atMax = photoNames.length >= 5;
  return (
    <div>
      <StepHeader
        title="Add photos"
        subtitle="Optional — a quick photo helps our team triage faster. Up to 5."
      />
      <div className="rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 p-6 text-center">
        <Camera className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Attach photos of the area</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We're rolling out real photo uploads soon — for now, attach files and
          our team will follow up to collect them.
        </p>
        <label className="mt-4 inline-flex">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onPick}
            disabled={atMax}
          />
          <span
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted ${
              atMax ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <ImagePlus className="h-4 w-4" />
            {photoNames.length === 0 ? "Choose photos" : "Add more"}
          </span>
        </label>
        {atMax && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Maximum of 5 photos.
          </p>
        )}
      </div>
      {photoNames.length > 0 && (
        <ul className="mt-4 space-y-2">
          {photoNames.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2 text-sm"
            >
              <span className="truncate">{name}</span>
              <button
                type="button"
                onClick={() => onRemove(name)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepDetails({
  notes,
  setNotes,
  windowStart,
  setWindowStart,
  windowEnd,
  setWindowEnd,
}: {
  notes: string;
  setNotes: (v: string) => void;
  windowStart: string;
  setWindowStart: (v: string) => void;
  windowEnd: string;
  setWindowEnd: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <StepHeader
          title="Tell us more"
          subtitle="Anything we should know? Gate codes, urgency, specific trees…"
        />
        <Textarea
          placeholder="A few sentences is plenty."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="resize-none text-base"
        />
      </div>
      <div>
        <h3 className="mb-2 font-serif text-lg leading-tight">
          Preferred window{" "}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Optional
          </span>
        </h3>
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
      </div>
    </div>
  );
}

function StepReview({
  service,
  property,
  photoCount,
  notes,
  windowStart,
  windowEnd,
}: {
  service: { label: string; emoji: string } | null;
  property: { address: string; city: string; zip: string } | null;
  photoCount: number;
  notes: string;
  windowStart: string;
  windowEnd: string;
}) {
  const fmt = (s: string) => {
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };
  return (
    <div>
      <StepHeader
        title="Review and submit"
        subtitle="Make sure everything looks right — you can go back to edit any step."
      />
      <dl className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/60 text-sm">
        <Row label="Service">
          {service ? (
            <span>
              {service.emoji} {service.label}
            </span>
          ) : (
            <span className="text-muted-foreground">Not chosen</span>
          )}
        </Row>
        <Row label="Property">
          {property ? (
            <span>
              {property.address}
              <span className="text-muted-foreground">
                {" "}
                · {property.city}, FL {property.zip}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              We'll confirm the address with you
            </span>
          )}
        </Row>
        <Row label="Photos">
          {photoCount > 0 ? (
            <span>
              {photoCount} attached
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Row>
        <Row label="Notes">
          {notes.trim() ? (
            <span className="whitespace-pre-wrap">{notes.trim()}</span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Row>
        <Row label="Preferred window">
          {windowStart || windowEnd ? (
            <span>
              {fmt(windowStart) ?? "any"} – {fmt(windowEnd) ?? "any"}
            </span>
          ) : (
            <span className="text-muted-foreground">Anytime</span>
          )}
        </Row>
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-36 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}
