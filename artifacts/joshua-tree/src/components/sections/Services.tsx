import { motion } from "framer-motion";
import { Trees, Scissors, Leaf, CloudLightning, TreePine, Construction, ArrowUpRight, Phone } from "lucide-react";
import { Eyebrow, ProofChip } from "@/components/BrandKit";

const supporting = [
  {
    title: "Tree Removal",
    sub: "Hazard mitigation",
    description: "Safe removal of leaning, dying, or storm-damaged trees with precision rigging.",
    icon: Trees,
    chips: ["Insured", "Crane-ready"],
    accent: "from-red-500/15 to-red-500/5",
    icoColor: "text-red-600",
    icoBg: "bg-red-500/10",
  },
  {
    title: "Trimming & Pruning",
    sub: "Structural & crown",
    description: "Improve tree health and clear roofs or power lines with ISA-informed cuts.",
    icon: Scissors,
    chips: ["ISA-method", "Certified"],
    accent: "from-primary/15 to-primary/5",
    icoColor: "text-primary",
    icoBg: "bg-primary/10",
  },
  {
    title: "Mangrove Care",
    sub: "Permitted & compliant",
    description: "Coastal trimming that follows FDEP regulations while preserving your views.",
    icon: Leaf,
    chips: ["Permits handled", "FDEP"],
    accent: "from-emerald-500/15 to-emerald-500/5",
    icoColor: "text-emerald-700",
    icoBg: "bg-emerald-500/10",
  },
  {
    title: "Stump Grinding",
    sub: "Grind, backfill, grade",
    description: "Thorough grinding to your preferred depth, prepped for sod or new landscaping.",
    icon: TreePine,
    chips: ["Hauling included"],
    accent: "from-amber-500/15 to-amber-500/5",
    icoColor: "text-amber-700",
    icoBg: "bg-amber-500/10",
  },
  {
    title: "Crane-Assisted Removal",
    sub: "Tight access, big trees",
    description: "Cranes 'pick' sections without shock-loading your yard or hardscape.",
    icon: Construction,
    chips: ["Heavy equipment"],
    accent: "from-sky-500/15 to-sky-500/5",
    icoColor: "text-sky-700",
    icoBg: "bg-sky-500/10",
  },
];

export function Services() {
  return (
    <section id="services" className="section-y bg-background relative overflow-hidden paper-grain">
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-14">
          <div className="max-w-2xl">
            <Eyebrow className="mb-4">Our Expertise</Eyebrow>
            <h3 className="font-display text-4xl md:text-6xl text-foreground text-balance">
              Comprehensive tree care, <span className="italic text-primary">end&nbsp;to&nbsp;end</span>.
            </h3>
          </div>
          <p className="text-foreground/70 max-w-md text-base leading-relaxed">
            ISA-informed practice and professional equipment for every job — from a single hazardous oak to whole-property storm cleanup.
          </p>
        </div>

        {/* Featured + grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Featured: Emergency Storm */}
          <motion.a
            href="tel:2398886817"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 relative group rounded-3xl overflow-hidden bg-foreground text-white p-8 md:p-10 min-h-[340px] md:min-h-[420px] flex flex-col justify-between border border-foreground/40"
          >
            <div className="absolute inset-0 z-0 opacity-50">
              <img src="/hero-oak.png" alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/80 to-accent/40" />
            </div>
            <div className="absolute -right-10 -top-10 w-72 h-72 bg-accent/30 blur-[100px] rounded-full" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="inline-flex items-center gap-2 bg-accent text-white text-[11px] uppercase tracking-[0.2em] font-bold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                24/7 Storm Response
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="relative z-10">
              <CloudLightning className="w-10 h-10 text-accent mb-4" />
              <h4 className="font-display text-3xl md:text-5xl mb-3 text-balance">Emergency storm response.</h4>
              <p className="text-white/85 max-w-md text-base leading-relaxed mb-6">
                Hurricane or squall damage? We mobilize within hours to assess, clear roads, and secure your property.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ProofChip tone="orange">On-call dispatch</ProofChip>
                <ProofChip tone="orange">Crane + chipper</ProofChip>
                <ProofChip tone="orange">Insurance friendly</ProofChip>
              </div>
              <div className="mt-6 flex items-center gap-2 text-accent font-semibold text-sm">
                <Phone className="w-4 h-4" /> Call (239) 888-6817
              </div>
            </div>
          </motion.a>

          {/* Supporting grid */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {supporting.slice(0, 4).map((s, i) => (
              <ServiceCard key={s.title} s={s} delay={i * 0.06} />
            ))}
          </div>

          {/* Last wider card */}
          <div className="lg:col-span-12">
            <ServiceCard s={supporting[4]} wide delay={0} />
          </div>
        </div>
      </div>
    </section>
  );
}

type S = typeof supporting[number];
function ServiceCard({ s, delay = 0, wide = false }: { s: S; delay?: number; wide?: boolean }) {
  const Icon = s.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      className={`group relative rounded-3xl bg-card border border-border overflow-hidden p-6 ${wide ? "md:p-8" : ""} hover:-translate-y-0.5 hover:shadow-xl transition-all`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl ${s.icoBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${s.icoColor}`} />
          </div>
          <ArrowUpRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground/80 group-hover:rotate-12 transition-all" />
        </div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/50 mb-1">{s.sub}</div>
        <h4 className="font-display text-2xl md:text-[28px] text-foreground mb-2 leading-tight">{s.title}</h4>
        <p className="text-foreground/70 text-sm leading-relaxed mb-4">{s.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {s.chips.map((c) => (
            <ProofChip key={c} tone="green">{c}</ProofChip>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
