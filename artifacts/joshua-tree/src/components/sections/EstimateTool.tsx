import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trees, Scissors, CloudLightning, TreePine, Leaf, HelpCircle,
  ArrowLeft, CheckCircle2, MapPin, Phone, Calendar, FileText,
  ChevronRight, Zap,
} from "lucide-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Pricing ──────────────────────────────────────────────────────────────────

type SizeKey = "small" | "medium" | "large" | "vlarge";
type ServiceKey = "removal" | "trimming" | "stump" | "emergency" | "mangrove" | "other";

const BASE_PRICES: Record<ServiceKey, Record<SizeKey, [number, number]>> = {
  removal:   { small: [200, 400],   medium: [500, 950],  large: [950, 1800],  vlarge: [1600, 3200] },
  trimming:  { small: [150, 280],   medium: [280, 520],  large: [480, 900],   vlarge: [800,  1500] },
  stump:     { small: [100, 200],   medium: [150, 280],  large: [200, 380],   vlarge: [300,  550]  },
  emergency: { small: [380, 700],   medium: [850, 1650], large: [1650, 3000], vlarge: [2800, 5500] },
  mangrove:  { small: [200, 380],   medium: [380, 700],  large: [650, 1200],  vlarge: [1000, 1800] },
  other:     { small: [250, 500],   medium: [500, 1000], large: [800, 1600],  vlarge: [1400, 2800] },
};

const COUNT_MULT: Record<string, [number, number]> = {
  "1":   [1.0, 1.0],
  "2-3": [1.9, 2.4],
  "4-6": [3.2, 4.2],
  "7+":  [5.5, 7.5],
};

const ACCESS_MULT: Record<string, number> = { easy: 1.0, mod: 1.2, diff: 1.5 };
const HAZARD_MULT: Record<string, number>  = { none: 1.0, structures: 1.25, powerlines: 1.5 };

function computeRange(
  serviceType: string,
  treeSize: string,
  treeCount: string,
  accessibility: string,
  hazards: string,
): { low: number; high: number } | null {
  if (!serviceType) return null;
  const sizes = BASE_PRICES[serviceType as ServiceKey];
  if (!sizes) return null;
  const sizeKey = ((treeSize || "medium") as SizeKey);
  const [bL, bH] = sizes[sizeKey] ?? sizes.medium;
  const [cL, cH] = COUNT_MULT[treeCount] ?? [1, 1];
  const aM = ACCESS_MULT[accessibility] ?? 1;
  const hM = HAZARD_MULT[hazards] ?? 1;
  const low  = Math.round(bL * cL * aM * hM / 50) * 50;
  const high = Math.round(bH * cH * aM * hM / 50) * 50;
  return { low, high };
}

function fmt(n: number) {
  return "$" + n.toLocaleString();
}

// ─── Animated number hook ─────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 550) {
  const [current, setCurrent] = useState(target);
  const rafRef  = useRef<number>();
  const fromRef = useRef(target);
  const t0Ref   = useRef<number>();

  useEffect(() => {
    if (target === fromRef.current) return;
    const from = fromRef.current;
    t0Ref.current = undefined;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = (ts: number) => {
      if (!t0Ref.current) t0Ref.current = ts;
      const p = Math.min((ts - t0Ref.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCurrent(Math.round(from + (target - from) * e));
      if (p < 1) { rafRef.current = requestAnimationFrame(animate); }
      else { fromRef.current = target; }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  removal: "Tree Removal", trimming: "Trimming / Pruning", stump: "Stump Grinding",
  emergency: "Emergency Service", mangrove: "Mangrove Care", other: "Other",
};
const SIZE_LABELS: Record<string, string> = {
  small: "Small (under 15 ft)", medium: "Medium (15–40 ft)",
  large: "Large (40–70 ft)", vlarge: "Very Large (70+ ft)",
};
const COUNT_LABELS: Record<string, string> = {
  "1": "1 tree", "2-3": "2–3 trees", "4-6": "4–6 trees", "7+": "7+ trees",
};
const ACCESS_LABELS: Record<string, string> = {
  easy: "Easy access", mod: "Moderate access", diff: "Difficult access",
};
const HAZARD_LABELS: Record<string, string> = {
  none: "No hazards", structures: "Near structures", powerlines: "Near power lines",
};

// ─── Estimate panel ───────────────────────────────────────────────────────────

interface PanelProps {
  serviceType: string;
  treeSize: string;
  treeCount: string;
  accessibility: string;
  hazards: string;
  city: string;
  compact?: boolean;
}

function EstimatePanel({
  serviceType, treeSize, treeCount, accessibility, hazards, city, compact,
}: PanelProps) {
  const range    = computeRange(serviceType, treeSize, treeCount, accessibility, hazards);
  const animLow  = useAnimatedNumber(range?.low  ?? 0);
  const animHigh = useAnimatedNumber(range?.high ?? 0);

  const chips = [
    serviceType   && SERVICE_LABELS[serviceType],
    treeCount     && COUNT_LABELS[treeCount],
    treeSize      && SIZE_LABELS[treeSize],
    accessibility && ACCESS_LABELS[accessibility],
    hazards       && HAZARD_LABELS[hazards],
    city,
  ].filter(Boolean) as string[];

  if (compact) {
    return (
      <div className="border-b border-border bg-primary/5 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
              Live Estimate
            </span>
          </div>
          {range ? (
            <div className="font-bold text-lg text-primary tabular-nums">
              {fmt(animLow)} – {fmt(animHigh)}
            </div>
          ) : (
            <span className="text-sm text-foreground/40 italic">Select a service to start</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: "#162716" }}>
      <div className="px-7 pt-7 pb-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Live Estimate
          </span>
        </div>

        <AnimatePresence mode="wait">
          {range ? (
            <motion.div
              key="estimate"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-white/40 text-xs mb-1.5">Estimated range</div>
              <div className="font-display text-[2.4rem] font-bold text-white leading-none tabular-nums">
                {fmt(animLow)}
                <span className="text-white/30 mx-1 text-3xl">–</span>
                {fmt(animHigh)}
              </div>
              <p className="text-xs text-white/35 mt-3 leading-relaxed">
                Ballpark based on your selections. Final price confirmed after a free on-site visit.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-white/30 text-sm font-medium mb-2">
                Your estimate will appear here
              </div>
              <div className="font-display text-[2.4rem] font-bold text-white/15 leading-none">
                $— – $—
              </div>
              <p className="text-xs text-white/25 mt-3">
                Select a service type to see a live price range
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {chips.length > 0 && (
        <div className="px-7 py-4 border-t border-white/10">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">
            Your selections
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="text-xs bg-white/10 text-white/60 rounded-full px-3 py-1"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-7 py-5 border-t border-white/10 space-y-3">
        {[
          "ISA-Certified Arborists",
          "Licensed & Fully Insured",
          "Free on-site consultation",
        ].map((text) => (
          <div key={text} className="flex items-center gap-2 text-xs text-white/45">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      <div className="px-7 pb-7">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-xs text-white/35 mb-1">Questions? Call us directly</p>
          <a
            href="tel:2398886817"
            className="text-lg font-bold text-primary hover:opacity-80 transition-opacity"
          >
            (239) 888-6817
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ estimate }: { estimate: { low: number; high: number } | null }) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5, delay: 0.15 }}
        className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5"
      >
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </motion.div>

      <h4 className="text-2xl font-serif font-bold mb-2">Request Received!</h4>
      {estimate && (
        <p className="text-base font-semibold text-primary mb-1">
          Estimated range: {fmt(estimate.low)} – {fmt(estimate.high)}
        </p>
      )}
      <p className="text-sm text-foreground/60 mb-8 max-w-xs">
        One of our ISA-Certified Arborists will be in touch shortly.
      </p>

      <div className="w-full max-w-sm text-left">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/35 mb-5 text-center">
          What happens next
        </div>
        {[
          {
            icon: Phone,
            title: "We'll call within 2 hours",
            desc: "An arborist reviews your request and calls to confirm details.",
          },
          {
            icon: Calendar,
            title: "Free on-site visit",
            desc: "We schedule a convenient time to assess your trees in person.",
          },
          {
            icon: FileText,
            title: "Written quote delivered",
            desc: "You receive a detailed, no-obligation written estimate.",
          },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className="flex items-start gap-4"
          >
            <div className="flex flex-col items-center shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              {i < 2 && <div className="w-px h-8 bg-border mt-1" />}
            </div>
            <div className="pt-1.5 pb-7">
              <div className="font-semibold text-sm">{item.title}</div>
              <div className="text-xs text-foreground/50 mt-0.5 leading-relaxed">{item.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-2 bg-gray-50 border border-border rounded-2xl p-5 w-full max-w-sm">
        <p className="text-sm text-foreground/60 mb-1">Need immediate help?</p>
        <a href="tel:2398886817" className="text-xl font-bold text-primary hover:underline">
          (239) 888-6817
        </a>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const stepLabels: Record<number, string> = {
  1: "Service Type",
  2: "Tree Details",
  3: "Site Conditions",
  4: "Location",
  5: "Your Estimate",
  6: "Contact Info",
};

const formSchema = z.object({
  serviceType:   z.string().min(1, "Please select a service type"),
  treeCount:     z.string().min(1, "Required"),
  treeSize:      z.string().min(1, "Required"),
  accessibility: z.string().min(1, "Required"),
  hazards:       z.string().min(1, "Required"),
  city:          z.string().min(1, "Please select your city"),
  zipCode:       z.string().min(5, "Invalid zip"),
  name:          z.string().min(2, "Name is required"),
  phone:         z.string().min(10, "Valid phone is required"),
  email:         z.string().email("Valid email is required"),
});

type FormValues = z.infer<typeof formSchema>;

const services = [
  { id: "removal",   label: "Tree Removal",      icon: Trees          },
  { id: "trimming",  label: "Trimming/Pruning",   icon: Scissors       },
  { id: "stump",     label: "Stump Grinding",     icon: TreePine       },
  { id: "emergency", label: "Emergency Service",  icon: CloudLightning },
  { id: "mangrove",  label: "Mangrove Care",      icon: Leaf           },
  { id: "other",     label: "Other",              icon: HelpCircle     },
];

const cities = [
  "Cape Coral", "Fort Myers", "Lehigh Acres", "Estero",
  "Bonita Springs", "Naples", "Port Charlotte", "Sarasota", "Venice",
];

const stepVariants = {
  enter:  (d: number) => ({ opacity: 0, y: d > 0 ? 18 : -18 }),
  center: { opacity: 1, y: 0 },
  exit:   (d: number) => ({ opacity: 0, y: d > 0 ? -18 : 18 }),
};

export function EstimateTool() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEstimate, setSubmittedEstimate] = useState<{ low: number; high: number } | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  const scrollIntoView = () => {
    setTimeout(() => {
      const el = formCardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }, 350);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serviceType: "", treeCount: "1", treeSize: "", accessibility: "",
      hazards: "", city: "", zipCode: "", name: "", phone: "", email: "",
    },
    mode: "onChange",
  });

  const watched = form.watch();
  const estimate = computeRange(
    watched.serviceType, watched.treeSize, watched.treeCount,
    watched.accessibility, watched.hazards,
  );

  const nextStep = async () => {
    const fieldsMap: Record<number, (keyof FormValues)[]> = {
      1: ["serviceType"],
      2: ["treeCount", "treeSize"],
      3: ["accessibility", "hazards"],
      4: ["city", "zipCode"],
    };
    const fields = fieldsMap[step] ?? [];
    const ok = fields.length === 0 || await form.trigger(fields);
    if (ok) { setDirection(1); setStep(s => s + 1); scrollIntoView(); }
  };

  const prevStep = () => {
    setDirection(-1);
    setStep(s => s - 1);
    scrollIntoView();
  };

  const goToStep = (n: number) => {
    setDirection(n < step ? -1 : 1);
    setStep(n);
    scrollIntoView();
  };

  const onSubmit = async (data: FormValues) => {
    const est = computeRange(data.serviceType, data.treeSize, data.treeCount, data.accessibility, data.hazards);
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    setSubmittedEstimate(est);
    setIsSuccess(true);
  };

  const panelProps: PanelProps = {
    serviceType:   watched.serviceType,
    treeSize:      watched.treeSize,
    treeCount:     watched.treeCount,
    accessibility: watched.accessibility,
    hazards:       watched.hazards,
    city:          watched.city,
  };

  return (
    <section id="estimate" className="section-y bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">

        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase mb-3">
            Free Estimate
          </h2>
          <h3 className="font-display text-4xl md:text-6xl text-foreground mb-3 text-balance">
            Request your <span className="italic text-primary">free quote</span>.
          </h3>
          <p className="text-base md:text-lg text-foreground/70">
            Answer 4 quick questions and see a live price estimate — no waiting.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">

          {/* ── Left: form card ── */}
          <div
            ref={formCardRef}
            className="bg-white rounded-3xl shadow-xl border border-border scroll-mt-24 overflow-hidden"
          >
            {/* Mobile estimate strip */}
            <div className="md:hidden">
              <EstimatePanel {...panelProps} compact />
            </div>

            {/* Progress bar */}
            {!isSuccess && (
              <div className="bg-gray-50 border-b border-border px-6 py-4 flex justify-between items-center relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 h-[3px] bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                />
                <span className="text-xs font-bold text-foreground/40 tracking-wide uppercase">
                  Step {step} of {TOTAL_STEPS}
                </span>
                <span className="text-xs font-bold text-primary tracking-wide uppercase">
                  {stepLabels[step]}
                </span>
              </div>
            )}

            <div className="p-5 md:p-10 relative">
              <AnimatePresence mode="wait" custom={direction}>
                {isSuccess ? (
                  <SuccessScreen estimate={submittedEstimate} />
                ) : (
                  <motion.div
                    key={`step-${step}`}
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* ── Step 1: Service type ── */}
                        {step === 1 && (
                          <FormField
                            control={form.control}
                            name="serviceType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-lg font-bold">
                                  What service do you need?
                                </FormLabel>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                                  {services.map((svc) => {
                                    const sel = field.value === svc.id;
                                    return (
                                      <div
                                        key={svc.id}
                                        onClick={() => field.onChange(svc.id)}
                                        className={`cursor-pointer rounded-2xl border-2 p-4 flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 ${
                                          sel
                                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                                            : "border-border hover:border-primary/30 hover:bg-gray-50 text-foreground"
                                        }`}
                                      >
                                        <svc.icon className={`w-7 h-7 ${sel ? "text-primary" : "text-foreground/40"}`} />
                                        <span className="font-semibold text-sm leading-tight">{svc.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* ── Step 2: Tree details ── */}
                        {step === 2 && (
                          <div className="space-y-6">
                            <FormField
                              control={form.control}
                              name="treeCount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">How many trees?</FormLabel>
                                  <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                                    {[
                                      { id: "1",   label: "1 Tree",     sub: ""               },
                                      { id: "2-3", label: "2–3 Trees",  sub: ""               },
                                      { id: "4-6", label: "4–6 Trees",  sub: ""               },
                                      { id: "7+",  label: "7+ Trees",   sub: "Bundle savings" },
                                    ].map((opt) => {
                                      const sel = field.value === opt.id;
                                      return (
                                        <div
                                          key={opt.id}
                                          onClick={() => field.onChange(opt.id)}
                                          className={`cursor-pointer rounded-2xl border-2 p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-95 ${
                                            sel
                                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                                              : "border-border hover:border-primary/30 hover:bg-gray-50"
                                          }`}
                                        >
                                          <Trees className={`w-6 h-6 ${sel ? "text-primary" : "text-foreground/35"}`} />
                                          <span className={`font-bold text-sm ${sel ? "text-primary" : "text-foreground"}`}>
                                            {opt.label}
                                          </span>
                                          {opt.sub && (
                                            <span className="text-[10px] text-foreground/40">{opt.sub}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="treeSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Approximate size</FormLabel>
                                  <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="grid grid-cols-2 gap-3 pt-1"
                                  >
                                    {[
                                      { id: "small",  label: "Small",      sub: "under 15 ft" },
                                      { id: "medium", label: "Medium",     sub: "15–40 ft"    },
                                      { id: "large",  label: "Large",      sub: "40–70 ft"    },
                                      { id: "vlarge", label: "Very Large", sub: "70+ ft"      },
                                    ].map((sz) => (
                                      <FormItem key={sz.id} className="relative">
                                        <FormControl>
                                          <RadioGroupItem value={sz.id} className="peer sr-only" />
                                        </FormControl>
                                        <FormLabel className="flex flex-col cursor-pointer rounded-xl border-2 p-4 hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary active:scale-95 transition-transform">
                                          <span className="text-sm font-bold">{sz.label}</span>
                                          <span className="text-xs font-normal text-foreground/50 mt-0.5">{sz.sub}</span>
                                        </FormLabel>
                                      </FormItem>
                                    ))}
                                  </RadioGroup>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* ── Step 3: Site conditions ── */}
                        {step === 3 && (
                          <div className="space-y-6">
                            <FormField
                              control={form.control}
                              name="accessibility"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">
                                    How accessible is the site?
                                  </FormLabel>
                                  <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="grid grid-cols-1 gap-3 pt-1"
                                  >
                                    {[
                                      { id: "easy", label: "Easy",     sub: "Front yard or open area"         },
                                      { id: "mod",  label: "Moderate", sub: "Backyard or gated access"        },
                                      { id: "diff", label: "Difficult", sub: "Tight space or near structures" },
                                    ].map((acc) => (
                                      <FormItem key={acc.id} className="relative">
                                        <FormControl>
                                          <RadioGroupItem value={acc.id} className="peer sr-only" />
                                        </FormControl>
                                        <FormLabel className="flex items-center justify-between cursor-pointer rounded-xl border-2 px-5 py-4 hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 active:scale-[0.99] transition-transform">
                                          <span className="font-semibold text-sm">{acc.label}</span>
                                          <span className="text-xs text-foreground/50">{acc.sub}</span>
                                        </FormLabel>
                                      </FormItem>
                                    ))}
                                  </RadioGroup>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="hazards"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Any hazards present?</FormLabel>
                                  <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="grid grid-cols-1 gap-3 pt-1"
                                  >
                                    {[
                                      { id: "none",       label: "None visible"             },
                                      { id: "structures", label: "Near home or structures"  },
                                      { id: "powerlines", label: "Near power lines"         },
                                    ].map((h) => (
                                      <FormItem key={h.id} className="relative">
                                        <FormControl>
                                          <RadioGroupItem value={h.id} className="peer sr-only" />
                                        </FormControl>
                                        <FormLabel className="flex cursor-pointer items-center rounded-xl border-2 px-5 py-4 font-semibold text-sm hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary active:scale-[0.99] transition-transform">
                                          {h.label}
                                        </FormLabel>
                                      </FormItem>
                                    ))}
                                  </RadioGroup>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* ── Step 4: Location ── */}
                        {step === 4 && (
                          <div className="space-y-5">
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">City</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-14 text-base rounded-xl">
                                        <SelectValue placeholder="Select your city" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {cities.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="zipCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Zip Code</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                      <Input
                                        placeholder="Enter zip code"
                                        inputMode="numeric"
                                        {...field}
                                        className="h-14 pl-12 rounded-xl text-base"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* ── Step 5: Estimate summary ── */}
                        {step === 5 && (
                          <div className="space-y-5">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/40 mb-1">
                                Your estimate
                              </div>
                              <h4 className="text-xl font-bold mb-5">Here's what we're looking at:</h4>
                            </div>

                            {estimate ? (
                              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center">
                                <div className="text-sm text-primary font-semibold mb-1">Estimated range</div>
                                <div className="font-display text-4xl md:text-5xl font-bold text-primary">
                                  {fmt(estimate.low)} – {fmt(estimate.high)}
                                </div>
                                <p className="text-xs text-foreground/50 mt-3 leading-relaxed max-w-xs mx-auto">
                                  Ballpark based on your answers. Final price confirmed after a free on-site visit — no surprises.
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-2xl bg-gray-50 border border-border p-6 text-center">
                                <span className="text-foreground/40 text-sm">
                                  Go back and complete the previous steps to see your estimate.
                                </span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { label: "Service",  value: SERVICE_LABELS[watched.serviceType]    },
                                { label: "Trees",    value: COUNT_LABELS[watched.treeCount]         },
                                { label: "Size",     value: SIZE_LABELS[watched.treeSize]           },
                                { label: "Access",   value: ACCESS_LABELS[watched.accessibility]    },
                                { label: "Hazards",  value: HAZARD_LABELS[watched.hazards]          },
                                { label: "Location", value: watched.city || undefined               },
                              ]
                                .filter((item) => item.value)
                                .map((item) => (
                                  <div
                                    key={item.label}
                                    className="rounded-xl bg-gray-50 border border-border p-3"
                                  >
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-0.5">
                                      {item.label}
                                    </div>
                                    <div className="text-sm font-semibold text-foreground">{item.value}</div>
                                  </div>
                                ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => goToStep(1)}
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                            >
                              <ArrowLeft className="w-3 h-3" /> Edit my answers
                            </button>
                          </div>
                        )}

                        {/* ── Step 6: Contact info ── */}
                        {step === 6 && (
                          <div className="space-y-5">
                            <div>
                              <h4 className="text-xl font-bold mb-1">Almost done!</h4>
                              <p className="text-sm text-foreground/60">
                                Where should we send your detailed quote?
                              </p>
                            </div>
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Full Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="John Doe"
                                      autoComplete="name"
                                      {...field}
                                      className="h-14 rounded-xl text-base"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Phone Number</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="tel"
                                      inputMode="tel"
                                      autoComplete="tel"
                                      placeholder="(239) 555-0123"
                                      {...field}
                                      className="h-14 rounded-xl text-base"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Email Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="email"
                                      inputMode="email"
                                      autoComplete="email"
                                      placeholder="john@example.com"
                                      {...field}
                                      className="h-14 rounded-xl text-base"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between pt-6 mt-2 border-t border-border">
                          {step > 1 ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={prevStep}
                              className="rounded-full h-12 px-6"
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                          ) : (
                            <div />
                          )}

                          {step < TOTAL_STEPS ? (
                            <Button
                              type="button"
                              onClick={nextStep}
                              className="rounded-full h-12 px-7 ml-auto"
                              disabled={step === 1 && !watched.serviceType}
                            >
                              {step === 5 ? (
                                <>Looks good — get my quote <ChevronRight className="w-4 h-4 ml-1" /></>
                              ) : (
                                <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                              )}
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              className="rounded-full h-12 px-7 ml-auto"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? "Submitting…" : "Get My Free Quote →"}
                            </Button>
                          )}
                        </div>
                      </form>
                    </Form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right: sticky estimate panel (desktop only) ── */}
          <div className="hidden md:block sticky top-24">
            <EstimatePanel {...panelProps} />
          </div>
        </div>
      </div>
    </section>
  );
}
