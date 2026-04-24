import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Phone, ShieldCheck, Trees } from "lucide-react";
import {
  usePortalRequestOtp,
  usePortalVerifyOtp,
  getPortalMeQueryKey,
  type PortalRequestOtpResult,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { DevOtpBanner } from "@/components/DevOtpBanner";

type Step = "phone" | "code";

function extractApiError(err: unknown): string {
  if (!err) return "Something went wrong. Try again.";
  const data = (err as { data?: { error?: string } }).data;
  const code = data?.error;
  switch (code) {
    case "invalid_phone":
      return "That phone number doesn't look right. Try again.";
    case "invalid_code":
      return "That code didn't match. Double-check and try again.";
    case "no_customer_for_phone":
      return "We don't recognize that number. Call our office and we'll add you.";
    case "too_many_otp_requests":
      return "Too many attempts — wait a few minutes and try again.";
    case "too_many_verify_attempts":
      return "Too many attempts — wait a few minutes and try again.";
    default:
      return (err as Error).message || "Something went wrong. Try again.";
  }
}

export function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const requestOtp = usePortalRequestOtp({
    mutation: {
      onSuccess: (data: PortalRequestOtpResult) => {
        setErrorMsg(null);
        setDevCode(data.devCode ?? null);
        setDevNotice(
          data.devMode
            ? data.devCode
              ? `Dev mode: code ${data.devCode} (also printed to the API console).`
              : (data.message ??
                "Dev mode: code printed to the API server console.")
            : null,
        );
        setStep("code");
      },
      onError: (err) => {
        setErrorMsg(extractApiError(err));
      },
    },
  });

  const verifyOtp = usePortalVerifyOtp({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getPortalMeQueryKey(),
        });
        setLocation("/");
      },
      onError: (err) => {
        setErrorMsg(extractApiError(err));
      },
    },
  });

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    requestOtp.mutate({ data: { phone } });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setErrorMsg("Enter the full 6-digit code.");
      return;
    }
    setErrorMsg(null);
    verifyOtp.mutate({ data: { phone, code } });
  }

  function handleResend() {
    setErrorMsg(null);
    setCode("");
    requestOtp.mutate({ data: { phone } });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <DevOtpBanner
        notice={devNotice}
        code={devCode}
        onAutoFill={devCode ? () => setCode(devCode) : undefined}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0%, transparent 45%), radial-gradient(circle at 85% 75%, hsl(var(--accent)) 0%, transparent 50%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-stretch px-4 sm:px-8">
        <div className="hidden flex-1 flex-col justify-between py-16 pr-12 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Trees className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-2xl">Joshua Tree</span>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Customer Portal
              </span>
            </span>
          </div>

          <div className="space-y-6">
            <h1 className="font-serif text-5xl leading-[1.05]">
              Welcome back to
              <br />
              <em className="text-primary not-italic">your tree care.</em>
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Sign in with your phone number to see upcoming visits, request a
              new service, and review past work — all in one place.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                <span>Request service in under a minute.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                <span>Track scheduled visits and assigned crews.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                <span>Keep a history of every property and job.</span>
              </li>
            </ul>
          </div>

          <div className="text-xs text-muted-foreground">
            ISA-Certified arborists · Serving Cape Coral &amp; Fort Myers since 2012
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-7 shadow-md sm:p-9">
            <div className="lg:hidden mb-6 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Trees className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="leading-tight">
                <span className="block font-serif text-lg">Joshua Tree</span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Customer Portal
                </span>
              </span>
            </div>

            {step === "phone" ? (
              <form onSubmit={handleRequest} className="space-y-6">
                <div className="space-y-2">
                  <h2 className="font-serif text-3xl">Sign in</h2>
                  <p className="text-sm text-muted-foreground">
                    We'll text a 6-digit code to confirm it's you.
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Phone number</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      autoFocus
                      placeholder="(239) 555-0101"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-11 pl-9 text-base"
                      required
                    />
                  </div>
                  <span className="block text-xs text-muted-foreground">
                    US numbers default to +1.
                  </span>
                </label>

                {errorMsg && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-11 w-full gap-1.5 text-base"
                  disabled={requestOtp.isPending || !phone.trim()}
                >
                  {requestOtp.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      Send code
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  We only use your number to confirm your account and contact
                  you about your service.
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-6">
                <div className="space-y-2">
                  <h2 className="font-serif text-3xl">Enter your code</h2>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{phone}</span>.
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(val) => setCode(val)}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setErrorMsg(null);
                      setDevCode(null);
                      setDevNotice(null);
                    }}
                  >
                    Use a different number
                  </button>
                </div>

                {errorMsg && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-11 w-full gap-1.5 text-base"
                  disabled={verifyOtp.isPending || code.length !== 6}
                >
                  {verifyOtp.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify and continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                  Didn't get it?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={requestOtp.isPending}
                    className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    {requestOtp.isPending ? "Resending…" : "Resend code"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
