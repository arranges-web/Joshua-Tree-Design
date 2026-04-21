import { motion } from "framer-motion";
import { Trees, Scissors, Leaf, CloudLightning, TreePine, Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function Services() {
  const services = [
    {
      title: "Tree Removal & Hazard Mitigation",
      description: "Safe removal of leaning, dying, or storm-damaged trees threatening structures, using precise rigging to protect your property.",
      icon: Trees,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Trimming & Pruning",
      description: "Expert structural and crown thinning to improve tree health, enhance canopy shape, and clear roofs or power lines.",
      icon: Scissors,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Mangrove Care",
      description: "Permitted, compliant trimming following Florida regulations to protect our coastal ecosystems while maintaining your views.",
      icon: Leaf,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Emergency Storm Response",
      description: "Rapid mobilization for hurricane and squall damage. We arrive within hours to assess, clear roads, and secure your property.",
      icon: CloudLightning,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "Stump Grinding & Hauling",
      description: "Thorough grinding to your preferred depth, followed by backfilling and grading to prepare for re-sodding or new landscaping.",
      icon: TreePine,
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      title: "Crane-Assisted Removal",
      description: "For tight access or over-structure hazards, we use cranes to safely 'pick' sections without shock-loading your yard.",
      icon: Construction,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <section id="services" className="py-24 bg-gray-50 relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold tracking-wider text-primary uppercase mb-3">Our Expertise</h2>
          <h3 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">Comprehensive Tree Care Solutions</h3>
          <p className="text-lg text-foreground/70">
            We combine ISA-informed practices with professional equipment to handle any job safely and efficiently.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Card className="h-full border-none shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white overflow-hidden group rounded-2xl">
                <CardContent className="p-8">
                  <div className={`w-14 h-14 rounded-2xl ${service.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <service.icon className={`w-7 h-7 ${service.color}`} />
                  </div>
                  <h4 className="text-xl font-bold mb-3">{service.title}</h4>
                  <p className="text-foreground/70 leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}