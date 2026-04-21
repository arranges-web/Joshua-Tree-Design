import { ArrowRight, Phone, Star, ShieldCheck, Award, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FloatingLeaves } from "@/components/TreeMotifs";
import { Counter, StatTile, StampBadge, Eyebrow } from "@/components/BrandKit";

export function Hero() {
  return (
    <section className="relative min-h-[88svh] md:min-h-[92svh] flex items-center pt-24 pb-12 md:pt-28 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-oak.png"
          alt="Lush Florida live oak canopy with sunlight filtering through"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/75 to-foreground/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
      </div>
      <FloatingLeaves className="z-[1]" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left: copy */}
          <div className="lg:col-span-7 xl:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3.5 py-1.5 w-fit mb-5"
            >
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
                ))}
              </div>
              <span className="text-white text-[13px] font-medium">4.9 from 1,400+ SWFL homeowners</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="font-display text-white text-[44px] sm:text-6xl lg:text-7xl xl:text-[88px] mb-5 text-balance"
            >
              Tree care, done by{" "}
              <span className="italic text-accent">certified</span> arborists.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-base md:text-lg text-white/85 leading-relaxed mb-8 max-w-xl"
            >
              Hazardous removals, expert pruning, and emergency storm response across Cape Coral, Fort Myers, and Southwest Florida — done right the first time.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <Button size="lg" className="rounded-full h-13 sm:h-14 px-7 text-base shadow-xl hover-elevate bg-primary hover:bg-primary/90 text-white" asChild>
                <a href="#estimate">
                  Get Free Estimate <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full h-13 sm:h-14 px-7 text-base bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm" asChild>
                <a href="tel:2398886817">
                  <Phone className="mr-2 w-5 h-5" />
                  (239) 888-6817
                </a>
              </Button>
            </motion.div>

            {/* Inline credentials row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-white/75 text-xs"
            >
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-accent" /> Licensed & Insured</span>
              <span className="hidden sm:inline w-px h-3 bg-white/20" />
              <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-accent" /> ISA-Certified Arborists</span>
              <span className="hidden sm:inline w-px h-3 bg-white/20" />
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-accent" /> 24/7 Storm Response</span>
            </motion.div>
          </div>

          {/* Right: anchor — stat cluster + stamp */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-5 xl:col-span-5 hidden lg:block relative"
          >
            <div className="relative bg-foreground/40 backdrop-blur-xl border border-white/15 rounded-[28px] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-accent font-bold">Trusted Since 2011</div>
                  <div className="font-display text-2xl text-white mt-1">By the numbers.</div>
                </div>
                <StampBadge title="Award" sub="Winner" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile value={14} suffix=" yrs" label="In Business" />
                <StatTile value={1400} suffix="+" label="Homeowners" />
                <StatTile value={4} suffix=".9★" label="Avg Rating" sub="Google" />
                <StatTile value={24} suffix="/7" label="Storm Dispatch" />
              </div>

              <div className="mt-5 pt-5 border-t border-white/15 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["#2C8214", "#E8620A", "#7CB342"].map((c, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white/30" style={{ background: c }} />
                  ))}
                </div>
                <div className="text-[13px] text-white/85 leading-tight">
                  <Counter to={1400} suffix="+" className="font-bold text-white" /> reviews
                  <span className="text-white/50"> • </span>
                  <span className="font-medium">A+ BBB Rated</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll affordance */}
        <motion.a
          href="#services"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 0.8 }, y: { duration: 2, repeat: Infinity } }}
          className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-1 text-white/60 hover:text-white text-[11px] uppercase tracking-[0.2em]"
        >
          Scroll
          <ChevronDown className="w-4 h-4" />
        </motion.a>
      </div>
    </section>
  );
}
