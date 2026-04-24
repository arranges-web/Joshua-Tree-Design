import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Trees } from "lucide-react";
import {
  usePortalLogout,
  type PortalCustomer,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/requests", label: "My Requests" },
  { href: "/new-request", label: "Request Service" },
];

export function Shell({
  customer,
  children,
}: {
  customer: PortalCustomer;
  children: ReactNode;
}) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const logout = usePortalLogout({
    mutation: {
      onSuccess: async () => {
        await queryClient.clear();
        setLocation("/login");
      },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-foreground">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Trees className="h-4.5 w-4.5" strokeWidth={2.25} />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-xl">Joshua Tree</span>
              <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Customer Portal
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? location === "/"
                  : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">
                {customer.fullName}
              </div>
              {customer.phoneE164 && (
                <div className="text-xs text-muted-foreground leading-tight">
                  {customer.phoneE164}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:hidden sm:px-8">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground/80",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Joshua Tree Inc. · ISA-Certified · Cape Coral &amp; Fort Myers, FL
      </footer>
    </div>
  );
}
