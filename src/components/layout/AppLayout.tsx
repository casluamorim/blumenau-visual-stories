import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background">
      <AppSidebar />
      <main className="md:ml-64 min-h-screen p-4 md:p-6 pt-20 md:pt-6 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
