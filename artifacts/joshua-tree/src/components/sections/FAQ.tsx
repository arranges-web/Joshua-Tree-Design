import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
  const faqs = [
    {
      q: "How much does tree removal cost?",
      a: "Costs vary based on tree size, location, and complexity. Contact us for a free, no-obligation estimate where we'll assess your specific situation and provide a clear, upfront price."
    },
    {
      q: "Do I need a permit for tree removal?",
      a: "In some areas of Southwest Florida, a permit may be required depending on the species and size of the tree. Our team is fully versed in local regulations and will handle all necessary permit paperwork for you."
    },
    {
      q: "How often should I trim my trees?",
      a: "Most mature trees benefit from structural trimming every 1-3 years to maintain health, safety, and proper clearance. Fast-growing species or palms may require more frequent maintenance."
    },
    {
      q: "Do you provide emergency tree removal?",
      a: "Yes! Our team is available for rapid response to storm damage and hazardous tree situations. We have the certified experts, the right heavy machinery, and equipment to secure your property safely."
    },
    {
      q: "Are you ISA-certified?",
      a: "Absolutely. We employ ISA-Certified Arborists and a Board Certified Master Arborist to ensure all pruning, removal, and plant health care meets the highest industry standards."
    },
    {
      q: "Do you handle mangrove pruning permits?",
      a: "Yes, we provide permitted, compliant mangrove trimming. We follow all Florida Department of Environmental Protection regulations to protect coastal ecosystems while maintaining your views."
    },
    {
      q: "Do you offer virtual consultations?",
      a: "Yes! We offer convenient virtual consultations via video call. You can walk us around your property using your phone, or send photos, and receive expert advice without scheduling an on-site visit."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold tracking-wider text-primary uppercase mb-3">Questions?</h2>
          <h3 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">Frequently Asked Questions</h3>
          <p className="text-lg text-foreground/70">
            Have a question not listed here? Call us directly at (239) 888-6817.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-gray-50 border border-border rounded-2xl px-6 data-[state=open]:bg-white data-[state=open]:border-primary/20 transition-colors"
            >
              <AccordionTrigger className="text-left font-bold text-lg hover:no-underline py-6">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-foreground/70 text-base leading-relaxed pb-6 pt-0">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}