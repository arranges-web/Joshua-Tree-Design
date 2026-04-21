import { motion } from "framer-motion";
import { Star, CheckCircle2 } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect } from "react";

export function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  useEffect(() => {
    if (!emblaApi) return;
    const autoplay = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);
    return () => clearInterval(autoplay);
  }, [emblaApi]);

  const reviews = [
    {
      name: "Gerard Vairo",
      text: "Great service and great work. I will use Joshua Tree every year and recommend them as well!",
    },
    {
      name: "Tyler Yurch",
      text: "Great company! Very professional they did an amazing job from start to finish.",
    },
    {
      name: "Cindy Haupt",
      text: "Arborist was punctual and courtesy. Scheduling was a breeze.",
    },
    {
      name: "Carolyn Marino",
      text: "Chris and the team worked at our property all day pruning two huge trees that were in terrible shape. They did a great job, left the property in great shape, and the price was reasonable.",
    },
    {
      name: "Steven Pandora",
      text: "I highly recommend them they're extremely professional, show up on time, and do what they say they'll do. They advised me correctly on a diseased tree that was not going to recover.",
    },
    {
      name: "Theresa Swanson",
      text: "The crew was super professional and actually showed up when they said they would, which is hard to find these days. They did a great job, cleaned up everything before they left.",
    },
    {
      name: "Michelle Miller",
      text: "Locally owned and family operated company. They are one of the only Companies around with certified arborists on their team. They're fair and honest.",
    }
  ];

  return (
    <section id="reviews" className="py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-sm font-bold tracking-wider text-primary uppercase mb-3">Customer Reviews</h2>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">1,400+ Southwest Florida Homeowners</h3>
            <p className="text-lg text-foreground/70">
              Join the thousands of homeowners who trust Joshua Tree Inc. for expert tree care.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 px-6 py-4 rounded-2xl w-fit">
            <div>
              <div className="flex text-accent mb-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-accent" />)}
              </div>
              <p className="text-sm font-bold">4.9 Average Rating</p>
            </div>
            <div className="w-px h-10 bg-border mx-2" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-8 h-8" />
          </div>
        </div>

        <div className="embla" ref={emblaRef}>
          <div className="embla__container flex gap-6">
            {reviews.map((review, i) => (
              <div key={i} className="embla__slide flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%] min-w-0">
                <div className="bg-gray-50 border border-border p-8 rounded-3xl h-full flex flex-col">
                  <div className="flex text-accent mb-6">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-accent" />)}
                  </div>
                  <p className="text-foreground/80 leading-relaxed mb-8 flex-grow italic">
                    "{review.text}"
                  </p>
                  <div className="flex items-center justify-between border-t border-border pt-6">
                    <p className="font-bold text-foreground">{review.name}</p>
                    <div className="flex items-center text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verified
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}