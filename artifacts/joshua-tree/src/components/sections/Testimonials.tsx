import { motion } from "framer-motion";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState, useCallback } from "react";
import { Eyebrow } from "@/components/BrandKit";

export function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", containScroll: "trimSnaps" });
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    setSnapCount(emblaApi.scrollSnapList().length);
    const autoplay = setInterval(() => emblaApi.scrollNext(), 6000);
    return () => {
      clearInterval(autoplay);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);
  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const reviews = [
    { name: "Gerard Vairo", text: "Great service and great work. I will use Joshua Tree every year and recommend them as well!" },
    { name: "Tyler Yurch", text: "Great company! Very professional they did an amazing job from start to finish." },
    { name: "Cindy Haupt", text: "Arborist was punctual and courtesy. Scheduling was a breeze." },
    { name: "Carolyn Marino", text: "Chris and the team worked at our property all day pruning two huge trees that were in terrible shape. They did a great job, left the property in great shape, and the price was reasonable." },
    { name: "Steven Pandora", text: "I highly recommend them they're extremely professional, show up on time, and do what they say they'll do. They advised me correctly on a diseased tree that was not going to recover." },
    { name: "Theresa Swanson", text: "The crew was super professional and actually showed up when they said they would, which is hard to find these days. They did a great job, cleaned up everything before they left." },
    { name: "Michelle Miller", text: "Locally owned and family operated company. They are one of the only companies around with certified arborists on their team. They're fair and honest." },
  ];

  return (
    <section id="reviews" className="section-y bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-12 gap-6">
          <div className="max-w-2xl">
            <Eyebrow className="mb-4">Customer Reviews</Eyebrow>
            <h3 className="font-display text-4xl md:text-6xl text-foreground text-balance">
              <span className="italic">1,400+</span> homeowners trust us.
            </h3>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 px-5 py-3 rounded-2xl w-fit border border-border">
            <div>
              <div className="flex text-accent mb-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-accent" />)}
              </div>
              <p className="text-xs font-bold tracking-wide">4.9 Avg • Google</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-7 h-7" />
          </div>
        </div>

        {/* Carousel container with overflow hidden */}
        <div className="relative">
          <div className="overflow-hidden -mx-4 px-4 md:mx-0 md:px-0" ref={emblaRef}>
            <div className="flex gap-4 md:gap-6">
              {reviews.map((review, i) => (
                <div
                  key={i}
                  className="flex-[0_0_85%] sm:flex-[0_0_60%] md:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc(33.333%-16px)] min-w-0"
                >
                  <motion.div
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    className="bg-gradient-to-br from-gray-50 to-white border border-border p-7 md:p-8 rounded-3xl h-full flex flex-col relative overflow-hidden"
                  >
                    <Quote className="absolute -top-2 -right-2 w-24 h-24 text-primary/5" />
                    <div className="flex text-accent mb-5 relative">
                      {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-accent" />)}
                    </div>
                    <p className="text-foreground/85 leading-relaxed mb-6 flex-grow text-[15px] relative">
                      "{review.text}"
                    </p>
                    <div className="flex items-center justify-between border-t border-border pt-5 relative">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-display text-base">
                          {review.name[0]}
                        </div>
                        <p className="font-semibold text-foreground text-sm">{review.name}</p>
                      </div>
                      <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Verified</span>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: snapCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === selected ? "w-8 bg-primary" : "w-1.5 bg-foreground/20 hover:bg-foreground/40"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                aria-label="Previous review"
                className="w-11 h-11 rounded-full border border-border bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next review"
                className="w-11 h-11 rounded-full border border-border bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
