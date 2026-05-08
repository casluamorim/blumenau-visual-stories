import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Financial = lazy(() => import('./pages/Financial'));
const FinancialPersonal = lazy(() => import('./pages/FinancialPersonal'));
const CashFlow = lazy(() => import('./pages/CashFlow'));
const Settings = lazy(() => import('./pages/Settings'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Contents = lazy(() => import('./pages/Contents'));
const TagsPage = lazy(() => import('./pages/TagsPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageFallback() {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background">
      <div className="text-muted-foreground">Carregando...</div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <PageFallback />;
  if (!user) return <Auth />;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/contents" element={<Contents />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/financial/personal" element={<FinancialPersonal />} />
        <Route path="/cashflow" element={<CashFlow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/portal/:slug" element={<ClientPortal />} />
            <Route path="/accept-invite/:token" element={<AcceptInvite />} />
            <Route path="/*" element={
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
