import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Redirect, useSearch } from 'wouter';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Requests from '@/pages/requests';
import RequestDetail from '@/pages/request-detail';
import Approvals from '@/pages/approvals';
import Invoices from '@/pages/invoices';
import Recommendations from '@/pages/recommendations';
import AuthScreen from '@/pages/auth';
import { AuthProvider, safeReturnPath, useAuth } from '@/lib/auth';

const queryClient = new QueryClient({ defaultOptions: { queries: {
  retry: (count, error) => (error as { status?: number }).status !== 401 && count < 1,
  refetchOnWindowFocus: true, refetchInterval: 30000,
} } });

function SessionGate() {
  const { user, phase, retry } = useAuth();
  const [location] = useLocation();
  const search = useSearch();
  if (phase === "loading") return <div className="grid min-h-[100dvh] place-items-center" role="status">Checking your ProcureFlow session…</div>;
  if (phase === "error") return <main className="mx-auto max-w-md p-8">
    <h1 className="text-2xl font-bold">ProcureFlow</h1>
    <p role="alert" className="my-4">We couldn’t check your session. Check your connection and try again.</p>
    <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={retry}>Try again</button>
  </main>;
  const entry = location === "/login" || location === "/signup";
  if (!user) {
    if (entry) return <AuthScreen key={location} />;
    const requested = safeReturnPath(`${location}${search ? `?${search}` : ""}`);
    return <Redirect to={`/login${requested === "/" ? "" : `?returnTo=${encodeURIComponent(requested)}`}`} replace />;
  }
  if (entry) return <Redirect to={safeReturnPath(new URLSearchParams(search).get("returnTo"))} replace />;
  return <Router />;
}

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
          <AuthProvider><SessionGate /></AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
