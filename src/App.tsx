import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Financial from "./pages/Financial";
import FinancialPersonal from "./pages/FinancialPersonal";
import CashFlow from "./pages/CashFlow";
import Settings from "./pages/Settings";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Contents from "./pages/Contents";
import TagsPage from "./pages/TagsPage";
import ActivityPage from "./pages/ActivityPage";
import ClientPortal from "./pages/ClientPortal";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/clients" element={<Clients />} />
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
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public portal route - no auth required */}
          <Route path="/portal/:token" element={<ClientPortal />} />
          {/* Public invite acceptance route */}
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          {/* All other routes require auth */}
          <Route path="/*" element={
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
