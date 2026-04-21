import { Award, ShieldCheck, CheckCircle2, Star } from "lucide-react";
import { Counter } from "@/components/BrandKit";

export function TrustStrip() {
  const credentials = [
    { icon: ShieldCheck, text: "ISA-Certified" },
    { icon: Award, text: "Master Arborist" },
    { icon: CheckCircle2, text: "Licensed & Insured" },
    { icon: Star, text: "A+ BBB Rated" },
  ];

  const stats = [
    { value: 14, suffix: "yrs", label: "In business" },
    { value: 1400, suffix: "+", label: "Homeowners served" },
    { value: 24, suffix: "/7", label: "Storm dispatch" },
    { value: 4, suffix: ".9★", label: "Google rating" },
  ];

  return (
    <div className="bg-foreground text-white border-y border-foreground/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 md:gap-x-8 items-center divide-y md:divide-y-0 md:divide-x divide-white/10">
          {stats.map((s, i) => (
            <div key={i} className={`flex flex-col items-center md:items-start ${i === 0 ? "" : "md:pl-8"} pt-5 md:pt-0 ${i < 2 ? "" : "border-t md:border-t-0"}`}>
              <div className="font-display text-3xl md:text-4xl text-white">
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/60 font-semibold mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="py-3 border-t border-white/10 flex flex-wrap justify-center md:justify-between items-center gap-3 md:gap-4 text-white/70 text-xs">
          {credentials.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <c.icon className="w-3.5 h-3.5 text-accent" />
              <span className="font-medium tracking-wide">{c.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
