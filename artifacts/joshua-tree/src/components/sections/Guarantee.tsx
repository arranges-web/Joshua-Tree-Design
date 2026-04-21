import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Guarantee() {
  return (
    <section className="py-24 bg-foreground text-white relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20">
        <img 
          src="/hero-oak.png" 
          alt="Background" 
          className="w-full h-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-foreground/80" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(232,98,10,0.4)]"
          >
            <ShieldCheck className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-serif font-bold mb-6"
          >
            Our 100% Satisfaction Guarantee
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/80 mb-12 leading-relaxed"
          >
            At Joshua Tree Inc., we stand behind our work. Our goal is simple: we're not happy until you are. Whether it's tree removal, pruning, or storm prep, we ensure that every job meets the highest standards.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
            {[
              { title: "Guaranteed Quality", desc: "We don't just get the job done; we get it done right." },
              { title: "No-Risk Service", desc: "If you're not satisfied, we'll make it right—no questions asked." },
              { title: "Customer-First", desc: "Committed to your property's safety, beauty, and your satisfaction." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                  <h4 className="font-bold text-lg">{item.title}</h4>
                </div>
                <p className="text-white/70 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Button size="lg" className="rounded-full bg-accent hover:bg-accent/90 text-white border-none h-14 px-8 text-lg" asChild>
              <a href="tel:2398886817">Experience the Difference: Call Now</a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}