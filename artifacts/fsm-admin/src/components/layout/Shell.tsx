import { useLogout, useGetMe, useListDepartments } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Users,
  Wrench,
  Menu,
  TreeDeciduous,
  Activity,
  Package,
  Building2,
  Calculator,
  HardHat,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { DepartmentProvider, useDepartmentFilter } from "@/context/DepartmentContext";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Users;
  // Roles permitted to see this nav entry. ADMIN always sees everything.
  roles?: ReadonlyArray<string>;
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Fleet & Shop",
    items: [
      { href: "/fleet", label: "Fleet Pulse", icon: Activity },
      { href: "/assets", label: "Asset Registry", icon: Package },
      { href: "/maintenance", label: "Maintenance Log", icon: Wrench },
      { href: "/crews", label: "Crews", icon: HardHat },
      { href: "/team", label: "Team", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/accounting",
        label: "Accounting",
        icon: Calculator,
        roles: ["ADMIN", "ACCOUNTING_MANAGER"],
      },
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
        <div className="text-lg font-bold tracking-tight text-sidebar-foreground">
          Joshua Tree
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-sidebar-foreground/60">
          Operations Console
        </div>
      </div>
    </div>
  );
}

function DepartmentSwitcher() {
  const { isAdmin } = useDepartmentFilter();
  if (!isAdmin) return null;
  return <DepartmentSwitcherInner />;
}

function DepartmentSwitcherInner() {
  const { activeDeptId, setActiveDeptId } = useDepartmentFilter();
  const { data: deptsData } = useListDepartments();

  const depts = deptsData?.departments ?? [];
  const value = activeDeptId == null ? "all" : String(activeDeptId);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Select
        value={value}
        onValueChange={(v) =>
          setActiveDeptId(v === "all" ? undefined : parseInt(v, 10))
        }
      >
        <SelectTrigger className="h-auto border-0 p-0 text-xs font-medium shadow-none focus:ring-0 w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {depts.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
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

  const role = authData?.user?.role ?? null;
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (role != null && item.roles.includes(role)),
    ),
  })).filter((group) => group.items.length > 0);

  const NavLinks = () => (
    <nav className="flex flex-col gap-5 py-4">
      {visibleGroups.map((group) => (
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
        {authData?.user?.department && (
          <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">
            {authData.user.department}
          </p>
        )}
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
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3 md:hidden">
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
          </div>
          <div className="hidden md:block" />
          <DepartmentSwitcher />
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DepartmentProvider>
      <ShellInner>{children}</ShellInner>
    </DepartmentProvider>
  );
}
