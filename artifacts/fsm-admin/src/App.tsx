import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";

import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Customers } from "@/pages/Customers";
import { Jobs } from "@/pages/Jobs";
import { Quotes } from "@/pages/Quotes";
import { Invoices } from "@/pages/Invoices";
import { Fleet } from "@/pages/Fleet";
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
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && error) {
      setLocation("/login");
    }
  }, [isLoading, error, setLocation]);

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
              <Route path="/" component={Dashboard} />
              <Route path="/customers" component={Customers} />
              <Route path="/jobs" component={Jobs} />
              <Route path="/quotes" component={Quotes} />
              <Route path="/invoices" component={Invoices} />
              <Route path="/fleet" component={Fleet} />
              <Route path="/maintenance" component={Maintenance} />
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
