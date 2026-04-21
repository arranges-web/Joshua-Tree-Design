import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trees, Scissors, CloudLightning, TreePine, Leaf, HelpCircle, 
  ArrowRight, ArrowLeft, CheckCircle2, MapPin
} from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TOTAL_STEPS = 5;

const formSchema = z.object({
  serviceType: z.string().min(1, "Please select a service type"),
  treeCount: z.string().min(1, "Required"),
  treeSize: z.string().min(1, "Required"),
  accessibility: z.string().min(1, "Required"),
  hazards: z.string().min(1, "Required"),
  city: z.string().min(1, "Please select your city"),
  zipCode: z.string().min(5, "Invalid zip"),
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone is required"),
  email: z.string().email("Valid email is required"),
});

type FormValues = z.infer<typeof formSchema>;

const stepLabels: Record<number, string> = {
  1: "Service Type",
  2: "Tree Details",
  3: "Site Conditions",
  4: "Location",
  5: "Contact Info",
};

export function EstimateTool() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const formCardRef = useRef<HTMLDivElement>(null);

  const scrollFormIntoView = () => {
    setTimeout(() => {
      const el = formCardRef.current;
      if (!el) return;
      const navOffset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }, 350);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serviceType: "",
      treeCount: "1",
      treeSize: "",
      accessibility: "",
      hazards: "",
      city: "",
      zipCode: "",
      name: "",
      phone: "",
      email: "",
    },
    mode: "onChange",
  });

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (step === 1) fieldsToValidate = ["serviceType"];
    if (step === 2) fieldsToValidate = ["treeCount", "treeSize"];
    if (step === 3) fieldsToValidate = ["accessibility", "hazards"];
    if (step === 4) fieldsToValidate = ["city", "zipCode"];

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setDirection(1);
      setStep(s => s + 1);
      scrollFormIntoView();
    }
  };

  const prevStep = () => {
    setDirection(-1);
    setStep(s => s - 1);
    scrollFormIntoView();
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const services = [
    { id: "removal", label: "Tree Removal", icon: Trees },
    { id: "trimming", label: "Trimming/Pruning", icon: Scissors },
    { id: "stump", label: "Stump Grinding", icon: TreePine },
    { id: "emergency", label: "Emergency Service", icon: CloudLightning },
    { id: "mangrove", label: "Mangrove Care", icon: Leaf },
    { id: "other", label: "Other", icon: HelpCircle },
  ];

  const cities = ["Cape Coral", "Fort Myers", "Lehigh Acres", "Estero", "Bonita Springs", "Naples", "Port Charlotte", "Sarasota", "Venice"];

  const variants = {
    enter: (dir: number) => ({ opacity: 0, y: dir > 0 ? 18 : -18 }),
    center: { opacity: 1, y: 0 },
    exit: (dir: number) => ({ opacity: 0, y: dir > 0 ? -18 : 18 }),
  };

  return (
    <section id="estimate" className="section-y bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">

        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase mb-3">Free Estimate</h2>
          <h3 className="font-display text-4xl md:text-6xl text-foreground mb-3 text-balance">
            Request your <span className="italic text-primary">free quote</span>.
          </h3>
          <p className="text-base md:text-lg text-foreground/70">
            Tell us about your project — it takes less than 2 minutes.
          </p>
        </div>

        <div ref={formCardRef} className="bg-white rounded-3xl shadow-xl border border-border scroll-mt-24 overflow-x-hidden">

          {/* Progress bar */}
          {!isSuccess && (
            <div className="bg-gray-50 border-b border-border px-6 py-4 flex justify-between items-center relative">
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
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center py-10"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5"
                  >
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </motion.div>
                  <h4 className="text-2xl font-serif font-bold mb-3">Request Received!</h4>
                  <p className="text-base text-foreground/70 mb-7 max-w-sm">
                    An ISA-Certified Arborist will contact you within 24 hours to schedule your free consultation.
                  </p>
                  <div className="bg-gray-50 border border-border rounded-2xl p-5 w-full max-w-xs">
                    <p className="text-sm text-foreground/60 mb-1">Need immediate help?</p>
                    <a href="tel:2398886817" className="text-xl font-bold text-primary hover:underline">
                      (239) 888-6817
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`step-${step}`}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                      {/* Step 1 — Service type */}
                      {step === 1 && (
                        <FormField
                          control={form.control}
                          name="serviceType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-lg font-bold">What service do you need?</FormLabel>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                                {services.map((service) => {
                                  const isSelected = field.value === service.id;
                                  return (
                                    <div
                                      key={service.id}
                                      onClick={() => field.onChange(service.id)}
                                      className={`cursor-pointer rounded-2xl border-2 p-4 flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 ${
                                        isSelected
                                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                                          : "border-border hover:border-primary/30 hover:bg-gray-50 text-foreground"
                                      }`}
                                    >
                                      <service.icon className={`w-7 h-7 ${isSelected ? "text-primary" : "text-foreground/40"}`} />
                                      <span className="font-semibold text-sm leading-tight">{service.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Step 2 — Tree count + size */}
                      {step === 2 && (
                        <div className="space-y-6">
                          <FormField
                            control={form.control}
                            name="treeCount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-lg font-bold">How many trees?</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-14 text-base rounded-xl">
                                      <SelectValue placeholder="Select quantity" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1">1 tree</SelectItem>
                                    <SelectItem value="2-3">2-3 trees</SelectItem>
                                    <SelectItem value="4-6">4-6 trees</SelectItem>
                                    <SelectItem value="7+">7+ trees</SelectItem>
                                    <SelectItem value="unsure">Not sure</SelectItem>
                                  </SelectContent>
                                </Select>
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
                                    { id: "small", label: "Small", sub: "under 15 ft" },
                                    { id: "medium", label: "Medium", sub: "15–40 ft" },
                                    { id: "large", label: "Large", sub: "40–70 ft" },
                                    { id: "vlarge", label: "Very Large", sub: "70+ ft" },
                                  ].map(size => (
                                    <FormItem key={size.id} className="relative">
                                      <FormControl>
                                        <RadioGroupItem value={size.id} className="peer sr-only" />
                                      </FormControl>
                                      <FormLabel className="flex flex-col cursor-pointer rounded-xl border-2 p-4 font-semibold hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary active:scale-95 transition-transform">
                                        <span className="text-sm font-bold">{size.label}</span>
                                        <span className="text-xs font-normal text-foreground/50 mt-0.5">{size.sub}</span>
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

                      {/* Step 3 — Accessibility + hazards */}
                      {step === 3 && (
                        <div className="space-y-6">
                          <FormField
                            control={form.control}
                            name="accessibility"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-lg font-bold">How accessible is the site?</FormLabel>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 gap-3 pt-1"
                                >
                                  {[
                                    { id: "easy", label: "Easy", sub: "Front yard or open area" },
                                    { id: "mod", label: "Moderate", sub: "Backyard or gated access" },
                                    { id: "diff", label: "Difficult", sub: "Tight space or near structures" },
                                  ].map(acc => (
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
                                    { id: "none", label: "None visible", sub: "" },
                                    { id: "structures", label: "Near home or structures", sub: "" },
                                    { id: "powerlines", label: "Near power lines", sub: "" },
                                  ].map(h => (
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

                      {/* Step 4 — Location */}
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
                                    {cities.map(city => (
                                      <SelectItem key={city} value={city}>{city}</SelectItem>
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

                      {/* Step 5 — Contact info */}
                      {step === 5 && (
                        <div className="space-y-5">
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
                            className="rounded-full h-12 px-8 bg-primary hover:bg-primary/90 text-white ml-auto"
                          >
                            Continue <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-full h-12 px-8 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20"
                          >
                            {isSubmitting ? "Submitting…" : "Submit Request"}
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
      </div>
    </section>
  );
}
