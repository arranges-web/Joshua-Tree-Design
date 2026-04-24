import { Link } from "wouter";
import { Trees } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0%, transparent 45%), radial-gradient(circle at 85% 75%, hsl(var(--accent)) 0%, transparent 50%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Trees className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Joshua Tree · Customer Portal
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-[1.05]">
          We couldn&rsquo;t find that page.
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          The link you followed may be out of date. Head back home to see your
          upcoming visits and recent service.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-5">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-5">
            <Link href="/requests/new">Request service</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
