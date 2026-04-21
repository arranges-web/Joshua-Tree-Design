import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

export function ServiceAreas() {
  const areas = [
    "Cape Coral",
    "Fort Myers",
    "Lehigh Acres",
    "Estero",
    "Bonita Springs",
    "Naples",
    "Port Charlotte",
    "Sarasota",
    "Venice"
  ];

  return (
    <section className="py-24 bg-gray-50 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          
          <div className="lg:w-1/3">
            <h2 className="text-sm font-bold tracking-wider text-primary uppercase mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Service Areas
            </h2>
            <h3 className="text-4xl font-serif font-bold text-foreground mb-6">Serving Southwest Florida</h3>
            <p className="text-lg text-foreground/70 mb-6">
              For more than a decade, we've been the trusted tree care experts for homeowners and businesses across the region—ensuring every yard stays vibrant, healthy, and storm-ready.
            </p>
          </div>

          <div className="lg:w-2/3 w-full">
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              {areas.map((area, i) => (
                <motion.div
                  key={area}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white border border-border rounded-full px-6 py-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-foreground font-medium flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-primary/50" />
                  {area}
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}