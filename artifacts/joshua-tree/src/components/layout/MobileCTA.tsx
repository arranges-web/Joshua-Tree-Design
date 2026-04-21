import { Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.08)] md:hidden">
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-full h-12 border-primary/20 text-primary bg-primary/5 font-semibold" asChild>
          <a href="tel:2398886817">
            <Phone className="w-5 h-5 mr-2" />
            Call
          </a>
        </Button>
        <Button className="flex-[2] rounded-full h-12 shadow-lg font-semibold" asChild>
          <a href="#estimate">
            <Calendar className="w-5 h-5 mr-2" />
            Free Estimate
          </a>
        </Button>
      </div>
    </div>
  );
}