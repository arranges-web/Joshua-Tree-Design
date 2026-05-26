import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import {
  useNeedsSetup,
  useSetupFounder,
  NEEDS_SETUP_KEY,
} from "@/lib/extra-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { TreeDeciduous, ShieldCheck, AlertCircle } from "lucide-react";

/**
 * Founder bootstrap page. Surfaces only when the database has zero
 * users — see `useNeedsSetup` + the AuthGuard redirect. Joshua (or
 * whoever opens the deploy first) fills in name + email + password,
 * we create the admin user on the server, set the session cookie
 * in the same response, and drop them on the admin home.
 *
 * After this runs once the page becomes inaccessible — even hitting
 * /setup directly will redirect because needsSetup flips to false.
 */
export function Setup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useNeedsSetup();
  const setup = useSetupFounder();

  // If somebody lands on /setup after setup has been completed,
  // bounce them to the login page instead of letting them stare at
  // a useless form.
  useEffect(() => {
    if (!isLoading && data && !data.needsSetup) {
      setLocation("/login");
    }
  }, [data, isLoading, setLocation]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setup.mutate(
      { fullName: fullName.trim(), email: email.trim(), password },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: NEEDS_SETUP_KEY });
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/");
        },
        onError: () => {
          setError("Couldn't create your account. Please try again.");
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4 sm:p-6">
        <Card className="w-full">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-sm">
                <TreeDeciduous className="h-6 w-6" />
              </div>
              <div className="leading-tight">
                <div className="text-2xl font-bold tracking-tight">
                  Joshua Tree
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  First-Time Setup
                </div>
              </div>
            </div>
            <CardTitle className="font-serif text-3xl">
              Create your founder account.
            </CardTitle>
            <CardDescription>
              This is the very first account on this console. You'll get full
              admin access and can invite teammates from <strong>Team</strong>{" "}
              once you're in.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName">Your name</Label>
                <Input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Joshua Bourne"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="joshua@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full"
                disabled={setup.isPending}
              >
                {setup.isPending ? "Creating account…" : "Create founder account"}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                One-time setup — this page disappears after you finish.
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
