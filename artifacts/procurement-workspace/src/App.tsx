import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Requests from '@/pages/requests';
import RequestDetail from '@/pages/request-detail';
import Approvals from '@/pages/approvals';
import Invoices from '@/pages/invoices';
import Recommendations from '@/pages/recommendations';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, refetchInterval: 30000 } } });

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/requests" component={Requests} />
          <Route path="/requests/:id" component={RequestDetail} />
          <Route path="/approvals" component={Approvals} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/recommendations" component={Recommendations} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    const page = location === "/" ? "Buying activity" : location.startsWith("/requests/") ? "Compare supplier offers" : ({ "/requests": "Procurement requests", "/approvals": "Manager approvals", "/invoices": "Invoice records", "/recommendations": "Supplier insights" }[location] ?? "Workspace");
    document.title = `${page} · ProcureFlow`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", `${page}: manage SME purchasing requirements, compare supplier quotes, and keep clear approval records with ProcureFlow.`);
  }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
