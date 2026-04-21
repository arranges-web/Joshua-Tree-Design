import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Eyebrow, LeafBullet } from "@/components/BrandKit";
import { Phone } from "lucide-react";

export function FAQ() {
  const faqs = [
    { q: "How much does tree removal cost?", a: "Costs vary based on tree size, location, and complexity. Contact us for a free, no-obligation estimate where we'll assess your specific situation and provide a clear, upfront price." },
    { q: "Do I need a permit for tree removal?", a: "In some areas of Southwest Florida, a permit may be required depending on the species and size of the tree. Our team is fully versed in local regulations and will handle all necessary permit paperwork for you." },
    { q: "How often should I trim my trees?", a: "Most mature trees benefit from structural trimming every 1–3 years to maintain health, safety, and proper clearance. Fast-growing species or palms may require more frequent maintenance." },
    { q: "Do you provide emergency tree removal?", a: "Yes — our team is on call for storm damage and hazardous tree situations. We have certified experts and the heavy machinery to secure your property safely." },
    { q: "Are you ISA-certified?", a: "Absolutely. We employ ISA-Certified Arborists and a Board Certified Master Arborist to ensure pruning, removal, and plant health care meet the highest industry standards." },
    { q: "Do you handle mangrove pruning permits?", a: "Yes — we provide permitted, compliant mangrove trimming following Florida Department of Environmental Protection regulations to protect coastal ecosystems while preserving your views." },
    { q: "Do you offer virtual consultations?", a: "Yes. We offer convenient consultations via video call. Walk us around your property using your phone or send photos and receive expert advice without an on-site visit." },
  ];

  return (
    <section id="faq" className="section-y bg-white">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <div className="text-center mb-10 md:mb-14">
          <Eyebrow className="mb-4 justify-center">Questions, answered</Eyebrow>
          <h3 className="font-display text-4xl md:text-6xl text-foreground mb-3 text-balance">Frequently asked.</h3>
          <p className="text-foreground/70 inline-flex items-center gap-2 text-sm">
            Don't see yours? <a href="tel:2398886817" className="text-primary font-semibold inline-flex items-center gap-1 hover:underline"><Phone className="w-4 h-4" /> (239) 888-6817</a>
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-gray-50 border border-border rounded-2xl px-5 md:px-6 data-[state=open]:bg-white data-[state=open]:border-primary/30 data-[state=open]:shadow-md transition-all"
            >
              <AccordionTrigger className="text-left font-semibold text-base md:text-lg hover:no-underline py-5">
                <span className="flex items-center gap-3">
                  <LeafBullet className="w-4 h-4 text-primary shrink-0" />
                  {faq.q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-foreground/70 text-[15px] leading-relaxed pb-5 pt-0 pl-7">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
