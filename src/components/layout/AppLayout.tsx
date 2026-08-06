import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { QuickCreateFab } from './QuickCreateFab';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background">
      <AppSidebar />
      <div className="pointer-events-none fixed right-4 top-3 z-50 md:right-6 md:top-4">
        <div className="pointer-events-auto rounded-full border border-border bg-card/80 backdrop-blur">
          <NotificationBell />
        </div>
      </div>
      <main className="md:ml-64 min-h-screen p-4 md:p-6 pt-20 md:pt-6 transition-all duration-300">
        {children}
      </main>
      <QuickCreateFab />
    </div>
  );
}
