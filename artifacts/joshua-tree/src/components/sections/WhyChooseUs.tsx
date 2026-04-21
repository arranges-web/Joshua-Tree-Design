import { motion } from "framer-motion";
import { CheckCircle2, Shield, Star, Clock, AlertTriangle, BadgeCheck } from "lucide-react";

export function WhyChooseUs() {
  const reasons = [
    {
      title: "ISA-Certified Arborists",
      description: "Ensuring the highest standards of tree care, guided by certified expertise.",
      icon: BadgeCheck,
    },
    {
      title: "14 Years in Business",
      description: "A legacy of quality service and customer satisfaction in Southwest Florida.",
      icon: Clock,
    },
    {
      title: "Highest-Rated Tree Company",
      description: "Hundreds of 5-star reviews and counting from your neighbors.",
      icon: Star,
    },
    {
      title: "Emergency Service",
      description: "Available to handle urgent situations and keep your property safe.",
      icon: AlertTriangle,
    },
    {
      title: "Fully Licensed & Insured",
      description: "Your safety, property protection, and peace of mind come first.",
      icon: Shield,
    },
    {
      title: "100% Satisfaction Guarantee",
      description: "We don't just get the job done; we get it done right.",
      icon: CheckCircle2,
    },
  ];

  return (
    <section id="why-choose-us" className="section-y bg-white relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase mb-4">Why Joshua Tree</h2>
            <h3 className="font-display text-4xl md:text-6xl text-foreground mb-4 text-balance">
              The difference is in the <span className="italic text-primary">details</span>.
            </h3>
            <p className="text-base md:text-lg text-foreground/70 mb-8 leading-relaxed">
              We're not just another tree service. We're SWFL's most trusted experts — and your yard is where life happens.
            </p>

            <div className="space-y-4 md:space-y-5">
              {reasons.map((reason, i) => (
                <motion.div 
                  key={i} 
                  className="flex gap-4"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15">
                    <reason.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-xl text-foreground leading-tight">{reason.title}</h4>
                    <p className="text-foreground/70 text-sm mt-0.5">{reason.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative h-[420px] md:h-[560px] lg:h-[640px] rounded-3xl overflow-hidden shadow-2xl"
          >
            <img 
              src="/arborist-palm.png" 
              alt="Professional arborist in safety gear" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl">
                <p className="text-white font-display text-xl md:text-2xl italic leading-snug">
                  "Nothing makes us prouder than seeing our customers enjoy safer, more beautiful landscapes."
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}