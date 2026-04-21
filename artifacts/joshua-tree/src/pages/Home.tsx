import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileCTA } from "@/components/layout/MobileCTA";
import { Hero } from "@/components/sections/Hero";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { Services } from "@/components/sections/Services";
import { Awards } from "@/components/sections/Awards";
import { WhyChooseUs } from "@/components/sections/WhyChooseUs";
import { Process } from "@/components/sections/Process";
import { Testimonials } from "@/components/sections/Testimonials";
import { Guarantee } from "@/components/sections/Guarantee";
import { VirtualConsultations } from "@/components/sections/VirtualConsultations";
import { ServiceAreas } from "@/components/sections/ServiceAreas";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { EstimateTool } from "@/components/sections/EstimateTool";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-grow">
        <Hero />
        <TrustStrip />
        <Services />
        <Awards />
        <WhyChooseUs />
        <Process />
        <Testimonials />
        <Guarantee />
        <VirtualConsultations />
        <ServiceAreas />
        <EstimateTool />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
      <MobileCTA />
    </div>
  );
}