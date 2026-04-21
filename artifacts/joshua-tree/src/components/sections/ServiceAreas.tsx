import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Eyebrow, ProofChip } from "@/components/BrandKit";
import { SwflMap } from "@/components/BrandKit";

export function ServiceAreas() {
  const areas = ["Cape Coral", "Fort Myers", "Lehigh Acres", "Estero", "Bonita Springs", "Naples", "Port Charlotte", "Sarasota", "Venice"];

  return (
    <section className="section-y bg-gray-50 border-t border-border canopy-grad">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <Eyebrow className="mb-4">Service Areas</Eyebrow>
            <h3 className="font-display text-4xl md:text-5xl text-foreground mb-4 text-balance">Rooted in Southwest Florida.</h3>
            <p className="text-foreground/70 mb-6 leading-relaxed">
              For more than a decade we've cared for trees from Sarasota down to Naples — keeping yards healthy, beautiful, and storm-ready.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {areas.map((area, i) => (
                <motion.span
                  key={area}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white border border-border rounded-full px-3.5 py-1.5 text-sm font-medium text-foreground/85 inline-flex items-center gap-1.5 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <MapPin className="w-3 h-3 text-primary/60" />
                  {area}
                </motion.span>
              ))}
            </div>
            <div className="flex gap-2">
              <ProofChip tone="green">Lee County</ProofChip>
              <ProofChip tone="green">Collier County</ProofChip>
              <ProofChip tone="green">Charlotte County</ProofChip>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7"
          >
            <div className="rounded-3xl bg-white border border-border shadow-xl overflow-hidden p-2">
              <SwflMap className="w-full h-auto" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
