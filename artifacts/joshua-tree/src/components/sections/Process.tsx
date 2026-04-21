import { motion } from "framer-motion";
import { User, ClipboardList, CheckCircle } from "lucide-react";

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
    <section className="py-24 bg-gray-50 relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-sm font-bold tracking-wider text-primary uppercase mb-3">Our Simple Process</h2>
          <h3 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">Tree Care Made Easy</h3>
          <p className="text-lg text-foreground/70">
            From the first call to the final cleanup, we make taking care of your trees a stress-free experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-[50px] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 z-0" />
          
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.5 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center mb-8 border-4 border-white relative group">
                <div className="absolute inset-0 rounded-full bg-primary/10 scale-0 group-hover:scale-100 transition-transform duration-300" />
                <step.icon className="w-10 h-10 text-primary relative z-10" />
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {step.num}
                </div>
              </div>
              <h4 className="text-2xl font-serif font-bold mb-2">{step.title}</h4>
              <p className="text-primary font-medium mb-4">{step.subtitle}</p>
              <p className="text-foreground/70 leading-relaxed max-w-sm">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}