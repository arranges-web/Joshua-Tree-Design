import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
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
import { TreeDeciduous } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TEST_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@joshuatreeinc.test",
    password: "password123",
    desc: "Full god-mode access to everything.",
  },
  {
    role: "Sales",
    email: "sales1@joshuatreeinc.test",
    password: "password123",
    desc: "Pipeline, customers, quotes.",
  },
  {
    role: "Crew Lead",
    email: "lead1@joshuatreeinc.test",
    password: "password123",
    desc: "Field jobs, photos, safety.",
  },
  {
    role: "Mechanic",
    email: "mechanic@joshuatreeinc.test",
    password: "password123",
    desc: "Trucks, equipment, maintenance.",
  },
];

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          // Honour ?next=... so QR deep-links + bookmarked URLs land back
          // on the originally requested page after authentication.
          const params = new URLSearchParams(window.location.search);
          const raw = params.get("next");
          let next: string | null = null;
          if (raw) {
            try {
              const decoded = decodeURIComponent(raw);
              // Only allow same-origin internal paths.
              if (decoded.startsWith("/") && !decoded.startsWith("//")) {
                next = decoded;
              }
            } catch {
              next = null;
            }
          }
          setLocation(next ?? "/");
        },
        onError: () => setErrorMsg("Invalid email or password"),
      },
    );
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 p-4 sm:gap-8 sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:p-10">
        {/* Left: branding + form */}
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
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  Operations Console
                </div>
              </div>
            </div>
            <CardTitle className="font-serif text-3xl">
              Welcome back.
            </CardTitle>
            <CardDescription>
              Sign in to run the day. Customers, jobs, fleet, and the whole
              shop — in one place.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive">
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@joshuatreeinc.test"
                  required
                  autoComplete="email"
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Right: test accounts */}
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Test Accounts
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Try every role, in one click.
            </h2>
            <p className="text-sm text-muted-foreground">
              Each role sees a different slice of the console based on the
              permissions matrix.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEST_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fill(a.email, a.password)}
                className="group rounded-lg border bg-card p-4 text-left transition hover:border-accent hover:shadow-md"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-serif text-lg font-semibold">
                    {a.role}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent opacity-0 transition group-hover:opacity-100">
                    Use →
                  </div>
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {a.email}
                </div>
                <div className="mt-1 font-mono text-xs">
                  pw: <span className="font-semibold">{a.password}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {a.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
