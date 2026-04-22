import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Tags,
  Activity,
  DollarSign,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Clientes', path: '/clients' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: FileText, label: 'Conteúdos', path: '/contents' },
  { icon: Tags, label: 'Tags', path: '/tags' },
  { icon: Activity, label: 'Atividades', path: '/activity' },
  { icon: DollarSign, label: 'Financeiro PJ', path: '/financial' },
  { icon: DollarSign, label: 'Financeiro PF', path: '/financial/personal' },
  { icon: TrendingUp, label: 'Fluxo de Caixa', path: '/cashflow' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="mb-2 truncate px-3 text-xs text-sidebar-foreground/50">
            {user?.email}
          </p>
        )}
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar border-sidebar-border p-0 flex flex-col">
              <div className="flex h-14 items-center border-b border-sidebar-border px-4">
                <span className="font-display text-xl font-bold text-sidebar-foreground">
                  Racun<span className="text-sidebar-primary">.</span>
                </span>
              </div>
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-display text-lg font-bold text-sidebar-foreground">
            Racun<span className="text-sidebar-primary">.</span>
          </span>
          <div className="w-9" />
        </header>
      </>
    );
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden md:flex h-screen flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <span className="font-display text-xl font-bold text-sidebar-foreground">
            Racun<span className="text-sidebar-primary">.</span>
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
