import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";

import { Login } from "@/pages/Login";
import { Customers } from "@/pages/Customers";
import { CustomerProfile } from "@/pages/CustomerProfile";
import { Leads } from "@/pages/Leads";
import { Jobs } from "@/pages/Jobs";
import { Quotes } from "@/pages/Quotes";
import { Invoices } from "@/pages/Invoices";
import { FleetPulse } from "@/pages/FleetPulse";
import { AssetRegistry } from "@/pages/AssetRegistry";
import { AssetActionPage } from "@/pages/AssetActionPage";
import { Maintenance } from "@/pages/Maintenance";
import { Employees } from "@/pages/Employees";
import { Permissions } from "@/pages/Permissions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: authData, isLoading, error } = useGetMe();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && error) {
      // Preserve the originally requested path (incl. query/hash) so the user
      // lands back on it after they log in. Critical for QR-code deep-links
      // from /assets/:slug — scanning while logged out should still get you
      // there after auth.
      const search = window.location.search ?? "";
      const hash = window.location.hash ?? "";
      const next = `${location}${search}${hash}`;
      const target =
        next && next !== "/" && next !== "/login"
          ? `/login?next=${encodeURIComponent(next)}`
          : "/login";
      setLocation(target);
    }
  }, [isLoading, error, setLocation, location]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error || !authData) {
    return null;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/(.*)">
        <AuthGuard>
          <Shell>
            <Switch>
              <Route path="/">
                <Redirect to="/fleet" />
              </Route>
              <Route path="/customers" component={Customers} />
              <Route path="/customers/:id" component={CustomerProfile} />
              <Route path="/leads" component={Leads} />
              <Route path="/jobs" component={Jobs} />
              <Route path="/quotes" component={Quotes} />
              <Route path="/invoices" component={Invoices} />
              <Route path="/fleet" component={FleetPulse} />
              <Route path="/assets" component={AssetRegistry} />
              <Route path="/assets/:slug" component={AssetActionPage} />
              <Route path="/maintenance" component={Maintenance} />
              <Route path="/team" component={Employees} />
              <Route path="/employees" component={Employees} />
              <Route path="/permissions" component={Permissions} />
              <Route component={NotFound} />
            </Switch>
          </Shell>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
