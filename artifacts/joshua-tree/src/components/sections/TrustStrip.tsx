import { Award, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

export function TrustStrip() {
  const credentials = [
    { icon: ShieldCheck, text: "ISA-Certified Arborists" },
    { icon: Award, text: "Board Certified Master Arborist" },
    { icon: CheckCircle2, text: "Licensed & Insured" },
    { icon: Star, text: "A+ BBB Rated" },
    { icon: Clock, text: "14 Years in Business" },
  ];

  function Star(props: React.ComponentProps<"svg">) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }

  return (
    <div className="bg-white border-b border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div className="py-8 flex flex-wrap justify-center md:justify-between items-center gap-6 md:gap-4">
          {credentials.map((cred, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <cred.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground/80 whitespace-nowrap">
                {cred.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}