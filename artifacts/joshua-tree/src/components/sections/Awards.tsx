import { motion } from "framer-motion";
import { Star, Trophy, ThumbsUp } from "lucide-react";

export function Awards() {
  const awards = [
    { title: "Best of Cape Coral", year: "2024", icon: Trophy },
    { title: "Best of Cape Coral", year: "2025", icon: Trophy },
    { title: "Best of North Fort Myers", year: "2024", icon: Trophy },
    { title: "Best of North Fort Myers", year: "2025", icon: Trophy },
    { title: "Best of Lehigh Acres", year: "2024", icon: Trophy },
    { title: "Best of Lehigh Acres", year: "2025", icon: Trophy },
    { title: "Neighborhood Faves", year: "2024", icon: ThumbsUp },
    { title: "Neighborhood Faves", year: "2025", icon: ThumbsUp },
  ];

  return (
    <section className="section-y bg-foreground text-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl mb-6 backdrop-blur-sm border border-white/10">
            <Star className="w-8 h-8 text-accent fill-accent" />
          </div>
          <h2 className="font-display text-4xl md:text-6xl mb-4 text-balance">Award-winning <span className="italic text-accent">tree&nbsp;care</span>.</h2>
          <p className="text-base md:text-lg text-white/75 max-w-xl mx-auto">
            We’re honored to be recognized as the best tree service across multiple Southwest Florida communities. Our dedication to safety and quality has earned us the trust of thousands.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
          {awards.map((award, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="group flex flex-col items-center justify-center p-4 md:p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm text-center hover:bg-white/10 hover:border-accent/40 transition-all"
            >
              <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center mb-3 shadow-[0_8px_20px_rgba(232,98,10,0.3)]">
                <span className="absolute inset-1 rounded-full border border-dashed border-white/30" />
                <award.icon className="w-5 h-5 md:w-6 md:h-6 text-white relative" />
              </div>
              <span className="font-mono-tab text-[10px] font-bold text-accent uppercase tracking-widest mb-0.5">{award.year}</span>
              <h4 className="font-display text-base md:text-lg leading-tight">{award.title}</h4>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 md:mt-14 text-center">
          <p className="text-base md:text-lg text-white/80">
            Proudly maintaining an <span className="text-accent font-semibold">A+ BBB Rating</span> & hundreds of 5-star reviews.
          </p>
        </div>
      </div>
    </section>
  );
}