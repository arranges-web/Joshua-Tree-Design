import { useLogout, useGetMe } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  LayoutDashboard,
  Users,
  Briefcase,
  FileSignature,
  Receipt,
  Truck,
  Wrench,
  IdCard,
  ShieldCheck,
  Menu,
  TreeDeciduous,
  Inbox,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: typeof Users }>;
}> = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { href: "/leads", label: "Leads", icon: Inbox },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/jobs", label: "Jobs", icon: Briefcase },
      { href: "/quotes", label: "Quotes", icon: FileSignature },
      { href: "/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    label: "Fleet & Shop",
    items: [
      { href: "/fleet", label: "Fleet", icon: Truck },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
    ],
  },
  {
    label: "People & Access",
    items: [
      { href: "/employees", label: "Employees", icon: IdCard },
      { href: "/permissions", label: "Permissions", icon: ShieldCheck },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-sm">
        <TreeDeciduous className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="font-serif text-lg italic tracking-tight text-sidebar-foreground">
          Joshua Tree
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-sidebar-foreground/60">
          Operations Console
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { data: authData } = useGetMe();
  const [location, setLocation] = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const NavLinks = () => (
    <nav className="flex flex-col gap-5 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-sidebar-foreground/50">
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                onClick={() => setIsMobileNavOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const UserCard = () => (
    <div className="border-t border-sidebar-border p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-sidebar-foreground">
          {authData?.user?.fullName ?? "—"}
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-sidebar-foreground/60">
          {authData?.user?.role ?? ""}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Log out
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <UserCard />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="flex h-16 items-center border-b border-sidebar-border px-5">
                <Brand />
              </div>
              <div className="flex-1 overflow-y-auto px-3">
                <NavLinks />
              </div>
              <UserCard />
            </SheetContent>
          </Sheet>
          <Brand />
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
