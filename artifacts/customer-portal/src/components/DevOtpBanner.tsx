import { Sparkles } from "lucide-react";

interface DevOtpBannerProps {
  notice: string | null;
  code: string | null;
  onAutoFill?: () => void;
}

export function DevOtpBanner({ notice, code, onAutoFill }: DevOtpBannerProps) {
  if (!notice && !code) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="dev-otp-banner"
      className="sticky top-0 z-50 border-b border-accent/40 bg-accent/15 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-xs sm:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 px-2 py-0.5 font-medium uppercase tracking-wider text-[10px] text-accent-foreground">
          <Sparkles className="h-3 w-3" />
          Dev mode
        </span>
        <span className="flex-1 text-foreground/80">
          {code ? (
            <>
              Your one-time code is{" "}
              <span className="font-mono font-semibold text-foreground">
                {code}
              </span>
              . Twilio is not configured, so it was also printed to the API
              server console.
            </>
          ) : (
            (notice ?? "Twilio is not configured — check the API server console for the code.")
          )}
        </span>
        {code && onAutoFill && (
          <button
            type="button"
            onClick={onAutoFill}
            className="rounded-md border border-accent/40 bg-background px-2.5 py-1 font-medium hover:bg-accent/10"
          >
            Auto-fill
          </button>
        )}
      </div>
    </div>
  );
}
