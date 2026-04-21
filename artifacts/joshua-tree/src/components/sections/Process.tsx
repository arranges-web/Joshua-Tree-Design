import { motion } from "framer-motion";
import { User, ClipboardList, CheckCircle } from "lucide-react";
import { BranchDivider } from "@/components/TreeMotifs";

export function Process() {
  const steps = [
    {
      num: "01",
      title: "Meet Your Arborist",
      subtitle: "Call for a Free Consultation",
      desc: "Your consult is guided by certified expertise—not a salesperson reading a script. We assess the health and safety of your trees.",
      icon: User,
    },
    {
      num: "02",
      title: "Expert Tree Care Plan",
      subtitle: "Get a Customized Plan",
      desc: "Our team will handle everything, from structural pruning to full hazardous tree removal. You get a clear, written estimate with no surprises.",
      icon: ClipboardList,
    },
    {
      num: "03",
      title: "Enjoy!",
      subtitle: "Enjoy a Safer, More Beautiful Yard",
      desc: "Relax knowing your landscape is in expert hands. We protect your property during work and leave the site pristine.",
      icon: CheckCircle,
    }
  ];

  return (
    <section id="process" className="section-y bg-gray-50 relative overflow-hidden paper-grain">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <BranchDivider className="max-w-md mx-auto mb-8 md:mb-12" />
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-20">
          <h2 className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase mb-3">Our Simple Process</h2>
          <h3 className="font-display text-4xl md:text-6xl text-foreground mb-4 text-balance">
            Tree care, <span className="italic text-primary">made easy</span>.
          </h3>
          <p className="text-base md:text-lg text-foreground/70 max-w-xl mx-auto">
            From the first call to the final cleanup — we make every step stress-free.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
          <div className="hidden md:block absolute top-[44px] left-[15%] right-[15%] h-px bg-[repeating-linear-gradient(to_right,hsl(var(--primary)/0.4)_0_8px,transparent_8px_16px)] z-0" />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white shadow-xl flex items-center justify-center mb-5 md:mb-7 border-4 border-white relative group">
                <step.icon className="w-8 h-8 md:w-10 md:h-10 text-primary relative z-10" />
                <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 px-2.5 h-7 md:h-8 rounded-full bg-accent text-white flex items-center justify-center font-display text-base shadow-md">
                  {step.num}
                </div>
              </div>
              <h4 className="font-display text-2xl md:text-3xl mb-1">{step.title}</h4>
              <p className="text-primary font-semibold text-sm mb-3">{step.subtitle}</p>
              <p className="text-foreground/70 leading-relaxed text-sm max-w-xs">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}