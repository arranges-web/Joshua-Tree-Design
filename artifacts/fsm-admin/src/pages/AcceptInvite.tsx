import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useInviteLookup, useAcceptInvite } from "@/lib/extra-api";
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
import { Badge } from "@/components/ui/badge";
import { TreeDeciduous, AlertCircle, UserPlus, Building2 } from "lucide-react";

/**
 * Public invite-acceptance page. URL shape: `/invite/<token>`.
 *
 * The token in the URL IS the auth gate; no session is required to
 * land here. We look the invite up to display its metadata (email,
 * role, dept, who invited you, expiry), then collect a name +
 * password and POST to /api/invites/:token/accept which:
 *   1. Creates the user with the role + dept pre-set by the inviter
 *   2. Marks the invite as used (single-use, race-safe)
 *   3. Sets the session cookie so we can drop them straight in
 */
export function AcceptInvite() {
  const [match, params] = useRoute("/invite/:token");
  const token = match ? (params?.token ?? "") : "";

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useInviteLookup(token);
  const accept = useAcceptInvite(token);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Once the lookup lands, pre-fill the form with the values the
  // founder already entered when they created the invite.
  useEffect(() => {
    if (!data?.invite) return;
    setFullName((cur) => cur || data.invite.fullName || "");
    setEmail((cur) => cur || data.invite.email);
  }, [data?.invite]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }
    accept.mutate(
      { fullName: fullName.trim(), email: email.trim(), password },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/");
        },
        onError: (err) => {
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 409) {
            setFormError(
              "That email is already registered. Sign in instead, or pick a different email.",
            );
          } else if (status === 410) {
            setFormError(
              "This invitation can't be used anymore — it may have already been claimed, revoked, or expired.",
            );
          } else {
            setFormError("Couldn't create your account. Please try again.");
          }
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

  if (error || !data?.invite) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;
    const reason =
      status === 410
        ? "This invitation has already been used, revoked, or expired."
        : status === 404
          ? "We couldn't find this invitation. Double-check the link your admin sent you."
          : "We couldn't load this invitation. Please ask your admin to send a new one.";
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4 sm:p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Invitation unavailable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{reason}</p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                Go to sign in
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const invite = data.invite;

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
                  Accept Invitation
                </div>
              </div>
            </div>
            <CardTitle className="font-serif text-2xl sm:text-3xl">
              {invite.createdByName
                ? `${invite.createdByName} invited you in.`
                : "You've been invited."}
            </CardTitle>
            <CardDescription>
              Set up your account to join the Joshua Tree admin console.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              {invite.roleKey && (
                <Badge variant="secondary" className="gap-1">
                  <UserPlus className="h-3 w-3" />
                  Role: {invite.roleKey.replace(/_/g, " ")}
                </Badge>
              )}
              {invite.departmentLabel && (
                <Badge variant="outline" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {invite.departmentLabel}
                </Badge>
              )}
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName">Your name</Label>
                <Input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Choose a password</Label>
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
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={accept.isPending}
              >
                {accept.isPending ? "Setting up…" : "Accept & sign in"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
