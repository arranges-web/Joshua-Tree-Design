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
    <section className="py-24 bg-foreground text-white relative overflow-hidden">
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
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">Award-Winning Service You Can Trust</h2>
          <p className="text-lg text-white/80">
            We’re honored to be recognized as the best tree service across multiple Southwest Florida communities. Our dedication to safety and quality has earned us the trust of thousands.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {awards.map((award, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm text-center hover:bg-white/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center mb-4">
                <award.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-white/60 uppercase tracking-widest mb-1">{award.year}</span>
              <h4 className="font-serif font-bold text-lg leading-tight">{award.title}</h4>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xl font-medium text-white/90">
            Proudly maintaining an <span className="text-accent font-bold">A+ BBB Rating</span> & hundreds of 5-star reviews.
          </p>
        </div>
      </div>
    </section>
  );
}