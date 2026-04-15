import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 min-h-screen p-6 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
