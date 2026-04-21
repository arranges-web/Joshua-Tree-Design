import { motion } from "framer-motion";

type SvgProps = React.SVGProps<SVGSVGElement>;

export function LeafMotif(props: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M32 4C18 14 10 26 10 38c0 12 10 22 22 22s22-10 22-22C54 26 46 14 32 4z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M32 8v50M32 22c-4 2-8 6-10 12M32 22c4 2 8 6 10 12M32 36c-3 2-6 5-7 9M32 36c3 2 6 5 7 9"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BranchDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/15 to-foreground/15" />
      <svg width="56" height="20" viewBox="0 0 56 20" fill="none" className="text-primary">
        <path d="M2 10 H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M34 10 H54" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M28 4c-3 1-5 3-5 6s2 5 5 6c3-1 5-3 5-6s-2-5-5-6z"
          fill="currentColor"
        />
        <path
          d="M28 4v12M24 8c1 .5 2 1 4 1.5M32 8c-1 .5-2 1-4 1.5"
          stroke="white"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-foreground/15 to-foreground/15" />
    </div>
  );
}

export function TreeSilhouette(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M95 240v-70h10v70z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M100 18c-26 0-48 16-56 40-22 6-32 32-18 50-10 16 0 38 22 38 6 12 22 18 36 14 8 10 26 12 36 4 10 8 28 6 36-4 14 4 30-2 36-14 22 0 32-22 22-38 14-18 4-44-18-50C148 34 126 18 100 18z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M100 60v110M100 90c-12-2-22-8-30-18M100 90c12-2 22-8 30-18M100 130c-14-2-26-8-36-18M100 130c14-2 26-8 36-18"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CanopyPattern({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 100"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M0 100 C60 60 120 60 180 100 C240 50 300 50 360 100 C420 65 480 65 540 100 C570 80 585 80 600 100 V0 H0 Z"
        fill="currentColor"
        opacity="0.06"
      />
      <path
        d="M0 100 C60 78 120 78 180 100 C240 70 300 70 360 100 C420 80 480 80 540 100 C570 90 585 90 600 100 V40 H0 Z"
        fill="currentColor"
        opacity="0.04"
      />
    </svg>
  );
}

export function FloatingLeaves({ className = "" }: { className?: string }) {
  const leaves = [
    { x: "10%", y: "20%", size: 28, rotate: -20, delay: 0 },
    { x: "82%", y: "12%", size: 36, rotate: 18, delay: 1.2 },
    { x: "70%", y: "70%", size: 24, rotate: 40, delay: 2.4 },
    { x: "18%", y: "75%", size: 32, rotate: -35, delay: 0.6 },
  ];
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {leaves.map((l, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/25"
          style={{ left: l.x, top: l.y }}
          animate={{ y: [0, -12, 0], rotate: [l.rotate, l.rotate + 8, l.rotate] }}
          transition={{ duration: 6, delay: l.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <LeafMotif width={l.size} height={l.size} />
        </motion.div>
      ))}
    </div>
  );
}
