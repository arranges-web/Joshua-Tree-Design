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

// --- Schema ---
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

export function EstimateTool() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const formCardRef = useRef<HTMLDivElement>(null);

  const scrollFormIntoView = () => {
    requestAnimationFrame(() => {
      const el = formCardRef.current;
      if (!el) return;
      const navOffset = 96;
      const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top, behavior: "smooth" });
    });
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

  const { formState: { errors } } = form;

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['serviceType'];
    if (step === 2) fieldsToValidate = ['treeCount', 'treeSize', 'accessibility', 'hazards'];
    if (step === 3) fieldsToValidate = ['city', 'zipCode'];
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep(s => s + 1);
      scrollFormIntoView();
    }
  };

  const prevStep = () => {
    setStep(s => s - 1);
    scrollFormIntoView();
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    // Simulate API call
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

  return (
    <section id="estimate" className="section-y bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase mb-3">Free Estimate</h2>
          <h3 className="font-display text-4xl md:text-6xl text-foreground mb-3 text-balance">Request your <span className="italic text-primary">free quote</span>.</h3>
          <p className="text-base md:text-lg text-foreground/70">
            Tell us about your project — it takes less than 2 minutes.
          </p>
        </div>

        <div ref={formCardRef} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-border scroll-mt-24">
          
          {/* Progress Bar */}
          {!isSuccess && (
            <div className="bg-gray-50 border-b border-border p-4 flex justify-between items-center px-8 relative">
              <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
              <span className="text-sm font-bold text-foreground/50">Step {step} of 4</span>
              <span className="text-sm font-bold text-primary">
                {step === 1 && "Service Type"}
                {step === 2 && "Tree Details"}
                {step === 3 && "Location"}
                {step === 4 && "Contact Info"}
              </span>
            </div>
          )}

          <div className="p-6 md:p-10 relative min-h-[400px]">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                    className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
                  >
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </motion.div>
                  <h4 className="text-3xl font-serif font-bold mb-4">Request Received!</h4>
                  <p className="text-lg text-foreground/70 mb-8 max-w-md">
                    Thank you. An ISA-Certified Arborist will contact you within 24 hours to schedule your free consultation.
                  </p>
                  <div className="bg-gray-50 border border-border rounded-2xl p-6 w-full max-w-sm">
                    <p className="text-sm text-foreground/60 mb-2">Need immediate assistance?</p>
                    <a href="tel:2398886817" className="text-xl font-bold text-primary hover:underline">
                      (239) 888-6817
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`step-${step}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                      
                      {/* Step 1 */}
                      {step === 1 && (
                        <div className="space-y-6">
                          <FormField
                            control={form.control}
                            name="serviceType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-lg font-bold">What service do you need?</FormLabel>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                                  {services.map((service) => {
                                    const isSelected = field.value === service.id;
                                    return (
                                      <div
                                        key={service.id}
                                        onClick={() => field.onChange(service.id)}
                                        className={`cursor-pointer rounded-2xl border-2 p-4 flex flex-col items-center justify-center text-center gap-3 transition-all ${
                                          isSelected 
                                            ? "border-primary bg-primary/5 text-primary shadow-sm" 
                                            : "border-border hover:border-primary/30 hover:bg-gray-50 text-foreground"
                                        }`}
                                      >
                                        <service.icon className={`w-8 h-8 ${isSelected ? "text-primary" : "text-foreground/50"}`} />
                                        <span className="font-semibold text-sm">{service.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Step 2 */}
                      {step === 2 && (
                        <div className="space-y-8">
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
                                <FormLabel className="text-lg font-bold">Approximate Size</FormLabel>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                >
                                  {[
                                    { id: "small", label: "Small (<15 ft)" },
                                    { id: "medium", label: "Medium (15-40 ft)" },
                                    { id: "large", label: "Large (40-70 ft)" },
                                    { id: "vlarge", label: "Very Large (70+ ft)" },
                                  ].map(size => (
                                    <FormItem key={size.id} className="relative">
                                      <FormControl>
                                        <RadioGroupItem value={size.id} className="peer sr-only" />
                                      </FormControl>
                                      <FormLabel className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 font-semibold hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary`}>
                                        {size.label}
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
                            name="accessibility"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-lg font-bold">Accessibility</FormLabel>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                >
                                  {[
                                    { id: "easy", label: "Easy (Front yard/Open)" },
                                    { id: "mod", label: "Moderate (Backyard/Gates)" },
                                    { id: "diff", label: "Difficult (Tight/Near structures)" }
                                  ].map(acc => (
                                    <FormItem key={acc.id} className="relative">
                                      <FormControl>
                                        <RadioGroupItem value={acc.id} className="peer sr-only" />
                                      </FormControl>
                                      <FormLabel className="flex flex-col cursor-pointer text-center rounded-xl border-2 p-4 font-semibold hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5">
                                        <span className="text-sm">{acc.label}</span>
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
                                <FormLabel className="text-lg font-bold">Any Hazards Present?</FormLabel>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                >
                                  {[
                                    { id: "none", label: "None visible" },
                                    { id: "structures", label: "Near home/structures" },
                                    { id: "powerlines", label: "Near power lines" },
                                  ].map(h => (
                                    <FormItem key={h.id} className="relative">
                                      <FormControl>
                                        <RadioGroupItem value={h.id} className="peer sr-only" />
                                      </FormControl>
                                      <FormLabel className="flex flex-col cursor-pointer text-center rounded-xl border-2 p-4 font-semibold hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5">
                                        <span className="text-sm">{h.label}</span>
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

                      {/* Step 3 */}
                      {step === 3 && (
                        <div className="space-y-6">
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
                                    <Input placeholder="Enter zip code" {...field} className="h-14 pl-12 rounded-xl text-base" />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Step 4 */}
                      {step === 4 && (
                        <div className="space-y-6">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-lg font-bold">Full Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="John Doe" {...field} className="h-14 rounded-xl text-base" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-lg font-bold">Phone Number</FormLabel>
                                  <FormControl>
                                    <Input type="tel" placeholder="(239) 555-0123" {...field} className="h-14 rounded-xl text-base" />
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
                                    <Input type="email" placeholder="john@example.com" {...field} className="h-14 rounded-xl text-base" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Controls */}
                      <div className="flex items-center justify-between pt-8 mt-8 border-t border-border">
                        {step > 1 ? (
                          <Button type="button" variant="outline" onClick={prevStep} className="rounded-full h-12 px-6">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                          </Button>
                        ) : (
                          <div />
                        )}
                        
                        {step < 4 ? (
                          <Button type="button" onClick={nextStep} className="rounded-full h-12 px-8 bg-primary hover:bg-primary/90 text-white ml-auto">
                            Next Step <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button type="submit" disabled={isSubmitting} className="rounded-full h-12 px-8 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20">
                            {isSubmitting ? "Submitting..." : "Submit Request"}
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