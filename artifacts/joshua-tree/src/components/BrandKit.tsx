import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-primary ${className}`}>
      <span className="inline-block w-6 h-px bg-primary" />
      {children}
    </div>
  );
}

export function ProofChip({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "orange" | "neutral" }) {
  const tones = {
    green: "bg-primary/10 text-primary",
    orange: "bg-accent/10 text-accent",
    neutral: "bg-foreground/8 text-foreground/80",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Counter({ to, suffix = "", duration = 1.6, className = "" }: { to: number; suffix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  const formatted = to >= 1000 ? val.toLocaleString() : String(val);
  return <span ref={ref} className={`font-mono-tab tabular-nums ${className}`}>{formatted}{suffix}</span>;
}

export function StatTile({ value, suffix, label, sub }: { value: number; suffix?: string; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-5 py-4 min-w-[140px]">
      <div className="text-3xl md:text-4xl font-display text-white">
        <Counter to={value} suffix={suffix} />
      </div>
      <div className="text-xs uppercase tracking-wider text-white/70 font-semibold mt-1">{label}</div>
      {sub && <div className="text-[11px] text-white/50 mt-0.5">{sub}</div>}
    </div>
  );
}

export function StampBadge({ title, sub }: { title: string; sub?: string }) {
  return (
    <motion.div
      initial={{ rotate: -6, opacity: 0, scale: 0.8 }}
      animate={{ rotate: -6, opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="relative w-28 h-28 rounded-full bg-accent text-white flex flex-col items-center justify-center text-center shadow-[0_10px_30px_rgba(232,98,10,0.4)] border-[3px] border-white/20"
    >
      <span className="absolute inset-2 rounded-full border border-dashed border-white/40" />
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold leading-tight px-2">{title}</span>
      {sub && <span className="text-[9px] uppercase tracking-widest opacity-80 mt-1">{sub}</span>}
    </motion.div>
  );
}

export function SwflMap({ className = "" }: { className?: string }) {
  // Stylized SWFL coastline silhouette with marker pins for service cities
  const cities = [
    { x: 270, y: 120, name: "Sarasota" },
    { x: 280, y: 155, name: "Venice" },
    { x: 295, y: 200, name: "Port Charlotte" },
    { x: 310, y: 250, name: "Cape Coral" },
    { x: 350, y: 260, name: "Fort Myers" },
    { x: 395, y: 270, name: "Lehigh Acres" },
    { x: 360, y: 305, name: "Estero" },
    { x: 365, y: 340, name: "Bonita Springs" },
    { x: 370, y: 380, name: "Naples" },
  ];
  return (
    <svg viewBox="0 0 480 440" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(107 30% 92%)" />
          <stop offset="1" stopColor="hsl(107 25% 82%)" />
        </linearGradient>
        <linearGradient id="gulf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(199 60% 92%)" />
          <stop offset="1" stopColor="hsl(199 55% 82%)" />
        </linearGradient>
      </defs>
      <rect width="480" height="440" fill="url(#gulf)" rx="24" />
      {/* Coastline / land mass — stylized SWFL */}
      <path
        d="M480 0 H 230 C 240 60 250 100 270 130 C 285 165 295 200 305 235 C 320 260 345 275 360 295 C 370 320 365 350 375 380 C 380 410 400 430 430 440 H 480 Z"
        fill="url(#land)"
      />
      {/* Inland strokes */}
      <path
        d="M310 250 Q 350 245 400 270 M340 295 Q 380 305 425 330"
        stroke="hsl(107 25% 70%)"
        strokeWidth="1.2"
        strokeDasharray="3 4"
        fill="none"
      />
      {/* Pins */}
      {cities.map((c) => (
        <g key={c.name}>
          <circle cx={c.x} cy={c.y} r="14" fill="hsl(24 92% 47% / 0.18)" />
          <circle cx={c.x} cy={c.y} r="5" fill="hsl(24 92% 47%)" stroke="white" strokeWidth="2" />
          <text
            x={c.x + 12}
            y={c.y + 4}
            fontSize="11"
            fontFamily="'Inter Tight', sans-serif"
            fontWeight="600"
            fill="hsl(107 40% 15%)"
          >
            {c.name}
          </text>
        </g>
      ))}
      {/* "Gulf of Mexico" label */}
      <text x="40" y="200" fontSize="13" fontFamily="'Instrument Serif', serif" fontStyle="italic" fill="hsl(199 35% 45%)">
        Gulf of Mexico
      </text>
    </svg>
  );
}

export function LeafBullet({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 2C6 6 4 11 4 15c0 4 4 7 8 7s8-3 8-7c0-4-2-9-8-13z"
        fill="currentColor"
      />
      <path d="M12 6v14M12 12c-2 .5-4 1.5-5 3M12 12c2 .5 4 1.5 5 3" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
