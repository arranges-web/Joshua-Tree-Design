import { ArrowRight, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FloatingLeaves } from "@/components/TreeMotifs";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/hero-oak.png" 
          alt="Lush Florida live oak canopy with sunlight filtering through" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/70 to-foreground/30" />
      </div>
      <FloatingLeaves className="z-[1]" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 w-fit mb-6"
          >
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-accent text-accent" />
              ))}
            </div>
            <span className="text-white text-sm font-medium">4.9★ from 1,400+ homeowners</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-serif font-bold text-white leading-[1.1] tracking-tight mb-6"
          >
            Expert Tree Care for a Safer, More Beautiful Property.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/90 leading-relaxed mb-10 max-w-2xl font-light"
          >
            Licensed, insured arborists keeping Southwest Florida safe. We handle hazardous removals, expert pruning, and emergency storm response—done right the first time.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button size="lg" className="rounded-full h-14 px-8 text-base shadow-xl hover-elevate bg-primary hover:bg-primary/90 text-white" asChild>
              <a href="#estimate">
                Get Free Estimate <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-base bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm" asChild>
              <a href="tel:2398886817">
                <Phone className="mr-2 w-5 h-5" />
                Call (239) 888-6817
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}