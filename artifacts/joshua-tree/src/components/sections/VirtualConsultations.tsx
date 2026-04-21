import { motion } from "framer-motion";
import { Laptop, Video, Clock, CheckCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VirtualConsultations() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1 relative"
          >
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl">
              <img 
                src="/mangrove.png" 
                alt="Virtual Consultation via device" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-foreground/20" />
              
              {/* Fake Video UI Overlay */}
              <div className="absolute inset-4 border-2 border-white/20 rounded-2xl flex flex-col justify-between p-4">
                <div className="self-end bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium">
                  04:28
                </div>
                <div className="flex justify-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white backdrop-blur-md shadow-lg">
                    <Video className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating badge */}
            <div className="absolute -bottom-8 -right-8 bg-white p-6 rounded-2xl shadow-xl hidden md:block border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">ISA-Certified</p>
                  <p className="text-sm text-foreground/60">Expert Analysis</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-bold tracking-wide mb-6">
              <Laptop className="w-4 h-4" />
              NEW: VIRTUAL CONSULTATIONS
            </div>
            
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              Expert Tree Care Guidance From Anywhere
            </h2>
            
            <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
              Your time is valuable. Connect with our ISA-Certified Arborists from your yard using a video call. Walk your property with us or send photos for expert analysis—no on-site visit required.
            </p>

            <ul className="space-y-6 mb-10">
              {[
                { title: "Fast & Convenient", desc: "Get expert advice without scheduling an in-person visit.", icon: Clock },
                { title: "No Obligation", desc: "Receive professional recommendations with no commitment.", icon: ShieldCheck },
                { title: "Easy & Interactive", desc: "Video chat directly from your phone while looking at the tree.", icon: Video },
              ].map((item, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{item.title}</h4>
                    <p className="text-sm text-foreground/70">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Button size="lg" className="rounded-full h-14 px-8 text-base shadow-lg hover-elevate" asChild>
              <a href="#estimate">Schedule Virtual Consult</a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
