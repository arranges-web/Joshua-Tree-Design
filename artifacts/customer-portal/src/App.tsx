import { useEffect, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePortalMe } from "@workspace/api-client-react";

import { Shell } from "@/components/Shell";
import { Login } from "@/pages/Login";
import { Home } from "@/pages/Home";
import { NewRequest } from "@/pages/NewRequest";
import { Requests } from "@/pages/Requests";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function PortalGuard({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = usePortalMe();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && error) {
      setLocation("/login");
    }
  }, [isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (error || !data) return null;

  return <Shell customer={data.customer}>{children}</Shell>;
}

function Routes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/(.*)">
        <PortalGuard>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/new-request" component={NewRequest} />
            <Route path="/requests" component={Requests} />
            <Route component={NotFound} />
          </Switch>
        </PortalGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Routes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
